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
    // === Investigate 5145 (Mantenimiento) for October 2025 ===

    // 1. Journals with 5145% items in Oct 2025
    const journals = await fetchAllRows('journals', 'id, name, date');
    const oct2025Journals = journals.filter(j => (j.date as string)?.startsWith('2025-10'));
    const octJournalIds = new Set(oct2025Journals.map(j => j.id as string));

    const items5145 = await fetchAllRows(
      'journal_items',
      'account_code, movement, value, journal_id, description',
      (q) => q.like('account_code', '5145%')
    );

    const oct5145FromJournals = items5145
      .filter(i => octJournalIds.has(i.journal_id as string))
      .map(i => {
        const journal = oct2025Journals.find(j => j.id === i.journal_id);
        return {
          source: 'CC',
          journal_name: (journal?.name as string) || '',
          journal_date: (journal?.date as string) || '',
          account_code: i.account_code as string,
          movement: i.movement as string,
          value: Number(i.value) || 0,
          description: (i.description as string) || '',
        };
      })
      .sort((a, b) => b.value - a.value);

    // 2. Purchase items with 5145% in Oct 2025
    const purchases = await fetchAllRows('purchases', 'id, date, name, supplier_name');
    const oct2025Purchases = purchases.filter(p => (p.date as string)?.startsWith('2025-10'));
    const octPurchaseIds = new Set(oct2025Purchases.map(p => p.id as string));

    const purchaseItems5145 = await fetchAllRows(
      'purchase_items',
      'account_code, price, quantity, purchase_id, description',
      (q) => q.like('account_code', '5145%')
    );

    const oct5145FromPurchases = purchaseItems5145
      .filter(i => octPurchaseIds.has(i.purchase_id as string))
      .map(i => {
        const purchase = oct2025Purchases.find(p => p.id === i.purchase_id);
        return {
          source: 'FC',
          purchase_name: (purchase?.name as string) || '',
          purchase_date: (purchase?.date as string) || '',
          supplier: (purchase?.supplier_name as string) || '',
          account_code: i.account_code as string,
          price: Number(i.price) || 0,
          quantity: Number(i.quantity) || 1,
          total: (Number(i.price) || 0) * (Number(i.quantity) || 1),
          description: (i.description as string) || '',
        };
      })
      .sort((a, b) => b.total - a.total);

    // 3. Also get ALL 5145 items across all months for context
    const all5145ByMonth = new Map<string, { cc_debit: number; cc_credit: number; fc_total: number }>();
    items5145.forEach(i => {
      const journalDate = journals.find(j => j.id === i.journal_id)?.date as string;
      const month = journalDate?.substring(0, 7);
      if (!month) return;
      if (!all5145ByMonth.has(month)) all5145ByMonth.set(month, { cc_debit: 0, cc_credit: 0, fc_total: 0 });
      const entry = all5145ByMonth.get(month)!;
      const val = Number(i.value) || 0;
      if (i.movement === 'Debit') entry.cc_debit += val;
      else entry.cc_credit += val;
    });
    purchaseItems5145.forEach(i => {
      const purchaseDate = purchases.find(p => p.id === i.purchase_id)?.date as string;
      const month = purchaseDate?.substring(0, 7);
      if (!month) return;
      if (!all5145ByMonth.has(month)) all5145ByMonth.set(month, { cc_debit: 0, cc_credit: 0, fc_total: 0 });
      const entry = all5145ByMonth.get(month)!;
      entry.fc_total += (Number(i.price) || 0) * (Number(i.quantity) || 1);
    });

    return NextResponse.json({
      investigation: '5145 Mantenimiento - Octubre 2025',
      oct_2025: {
        journals_count: oct2025Journals.length,
        purchases_count: oct2025Purchases.length,
        cc_items: oct5145FromJournals,
        cc_total_debit: Math.round(oct5145FromJournals.filter(i => i.movement === 'Debit').reduce((s, i) => s + i.value, 0)),
        cc_total_credit: Math.round(oct5145FromJournals.filter(i => i.movement === 'Credit').reduce((s, i) => s + i.value, 0)),
        fc_items: oct5145FromPurchases,
        fc_total: Math.round(oct5145FromPurchases.reduce((s, i) => s + i.total, 0)),
        grand_total: Math.round(
          oct5145FromJournals.filter(i => i.movement === 'Debit').reduce((s, i) => s + i.value, 0) +
          oct5145FromPurchases.reduce((s, i) => s + i.total, 0)
        ),
      },
      monthly_summary_5145: Object.fromEntries(
        Array.from(all5145ByMonth.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, data]) => [month, {
            cc_debit: Math.round(data.cc_debit),
            cc_credit: Math.round(data.cc_credit),
            fc_total: Math.round(data.fc_total),
            net: Math.round(data.cc_debit - data.cc_credit + data.fc_total),
          }])
      ),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
