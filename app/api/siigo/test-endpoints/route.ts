import { NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

export const maxDuration = 60;

// Paginated fetch helper
async function fetchAllRows(
  table: string,
  select: string,
  applyFilters?: (query: ReturnType<typeof atelierTableAdmin>) => ReturnType<typeof atelierTableAdmin>
) {
  const PAGE_SIZE = 1000;
  let allData: Record<string, unknown>[] = [];
  let from = 0;
  while (true) {
    let query = atelierTableAdmin(table).select(select).range(from, from + PAGE_SIZE - 1);
    if (applyFilters) query = applyFilters(query);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allData;
}

export async function GET() {
  try {
    // 1. Get journal name prefixes (document types) and their counts
    const journals = await fetchAllRows('journals', 'id, name, date');
    const journalPrefixes = new Map<string, number>();
    const journalDateMap = new Map<string, string>();
    journals.forEach((j) => {
      const name = (j.name as string) || '';
      const prefix = name.split('-')[0] || 'unknown';
      journalPrefixes.set(prefix, (journalPrefixes.get(prefix) || 0) + 1);
      journalDateMap.set(j.id as string, (j.date as string) || '');
    });

    // 2. Get ALL journal_items with 51% accounts (both Debit and Credit)
    const items51 = await fetchAllRows(
      'journal_items',
      'account_code, movement, value, journal_id',
      (q) => q.like('account_code', '51%')
    );

    // Group by journal name prefix to see which doc types contribute to 51xx
    const items51ByDocType = new Map<string, { debit: number; credit: number; count: number }>();
    items51.forEach((item) => {
      const journalId = item.journal_id as string;
      const journalName = journals.find(j => j.id === journalId)?.name as string || '';
      const prefix = journalName.split('-')[0] || 'unknown';
      if (!items51ByDocType.has(prefix)) items51ByDocType.set(prefix, { debit: 0, credit: 0, count: 0 });
      const entry = items51ByDocType.get(prefix)!;
      entry.count++;
      const val = Number(item.value) || 0;
      if (item.movement === 'Debit') entry.debit += val;
      else entry.credit += val;
    });

    // 3. Get ALL journal_items with 53% accounts (financieros)
    const items53 = await fetchAllRows(
      'journal_items',
      'account_code, movement, value, journal_id',
      (q) => q.like('account_code', '53%')
    );
    const items53ByDocType = new Map<string, { debit: number; credit: number; count: number }>();
    items53.forEach((item) => {
      const journalId = item.journal_id as string;
      const journalName = journals.find(j => j.id === journalId)?.name as string || '';
      const prefix = journalName.split('-')[0] || 'unknown';
      if (!items53ByDocType.has(prefix)) items53ByDocType.set(prefix, { debit: 0, credit: 0, count: 0 });
      const entry = items53ByDocType.get(prefix)!;
      entry.count++;
      const val = Number(item.value) || 0;
      if (item.movement === 'Debit') entry.debit += val;
      else entry.credit += val;
    });

    // 4. Get ALL journal_items with 6135% accounts (COGS)
    const items6135 = await fetchAllRows(
      'journal_items',
      'account_code, movement, value, journal_id',
      (q) => q.like('account_code', '6135%')
    );
    const items6135ByDocType = new Map<string, { debit: number; credit: number; count: number }>();
    items6135.forEach((item) => {
      const journalId = item.journal_id as string;
      const journalName = journals.find(j => j.id === journalId)?.name as string || '';
      const prefix = journalName.split('-')[0] || 'unknown';
      if (!items6135ByDocType.has(prefix)) items6135ByDocType.set(prefix, { debit: 0, credit: 0, count: 0 });
      const entry = items6135ByDocType.get(prefix)!;
      entry.count++;
      const val = Number(item.value) || 0;
      if (item.movement === 'Debit') entry.debit += val;
      else entry.credit += val;
    });

    // 5. Check purchase_items for overlapping 51% accounts
    const purchaseItems51 = await fetchAllRows(
      'purchase_items',
      'account_code, price, quantity, purchase_id'  ,
      (q) => q.like('account_code', '51%')
    );
    // Group by 4-digit prefix
    const purchaseItems51By4 = new Map<string, { count: number; total: number }>();
    purchaseItems51.forEach((item) => {
      const code4 = ((item.account_code as string) || '').substring(0, 4);
      if (!purchaseItems51By4.has(code4)) purchaseItems51By4.set(code4, { count: 0, total: 0 });
      const entry = purchaseItems51By4.get(code4)!;
      entry.count++;
      entry.total += (Number(item.price) || 0) * (Number(item.quantity) || 1);
    });

    // 6. Check: Are journal_items from CC journals duplicating purchase_items?
    // Look at January 2025 specifically
    const jan2025Journals = journals.filter(j => (j.date as string)?.startsWith('2025-01'));
    const jan2025JournalIds = new Set(jan2025Journals.map(j => j.id as string));

    const jan51FromJournals = items51.filter(i => jan2025JournalIds.has(i.journal_id as string));
    const jan51Debit = jan51FromJournals.filter(i => i.movement === 'Debit').reduce((s, i) => s + (Number(i.value) || 0), 0);
    const jan51Credit = jan51FromJournals.filter(i => i.movement === 'Credit').reduce((s, i) => s + (Number(i.value) || 0), 0);

    const purchases = await fetchAllRows('purchases', 'id, date');
    const jan2025Purchases = purchases.filter(p => (p.date as string)?.startsWith('2025-01'));
    const jan2025PurchaseIds = new Set(jan2025Purchases.map(p => p.id as string));
    const janPurchase51 = purchaseItems51.filter(i => jan2025PurchaseIds.has(i.purchase_id as string));
    const janPurchase51Total = janPurchase51.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0);

    // 7. Total journal_items count
    const totalItems = await fetchAllRows('journal_items', 'id', (q) => q);

    return NextResponse.json({
      journal_count: journals.length,
      journal_item_count: totalItems.length,
      journal_doc_types: Object.fromEntries(
        Array.from(journalPrefixes.entries()).sort((a, b) => b[1] - a[1])
      ),
      admin_51_by_doc_type: Object.fromEntries(
        Array.from(items51ByDocType.entries())
          .sort((a, b) => b[1].debit - a[1].debit)
          .map(([k, v]) => [k, { count: v.count, debit: Math.round(v.debit), credit: Math.round(v.credit) }])
      ),
      financieros_53_by_doc_type: Object.fromEntries(
        Array.from(items53ByDocType.entries())
          .sort((a, b) => b[1].debit - a[1].debit)
          .map(([k, v]) => [k, { count: v.count, debit: Math.round(v.debit), credit: Math.round(v.credit) }])
      ),
      cogs_6135_by_doc_type: Object.fromEntries(
        Array.from(items6135ByDocType.entries())
          .sort((a, b) => b[1].debit - a[1].debit)
          .map(([k, v]) => [k, { count: v.count, debit: Math.round(v.debit), credit: Math.round(v.credit) }])
      ),
      purchase_items_51_by_subcat: Object.fromEntries(
        Array.from(purchaseItems51By4.entries())
          .sort((a, b) => b[1].total - a[1].total)
          .map(([k, v]) => [k, { count: v.count, total: Math.round(v.total) }])
      ),
      january_2025_detail: {
        journals_count: jan2025Journals.length,
        journal_51_items: jan51FromJournals.length,
        journal_51_debit: Math.round(jan51Debit),
        journal_51_credit: Math.round(jan51Credit),
        purchases_count: jan2025Purchases.length,
        purchase_51_items: janPurchase51.length,
        purchase_51_total: Math.round(janPurchase51Total),
        combined_51: Math.round(jan51Debit + janPurchase51Total),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
