import { NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

export const maxDuration = 60;

async function fetchAllRows(
  table: string, select: string,
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
    // === Otros Ingresos (42) — Todo 2025 desde DB ===

    // Journals (CC)
    const journals = await fetchAllRows('journals', 'id, name, date');
    const journals2025 = journals.filter(j => (j.date as string)?.startsWith('2025'));
    const journalIds2025 = new Set(journals2025.map(j => j.id as string));

    const journalItems42 = await fetchAllRows(
      'journal_items',
      'account_code, movement, value, journal_id, description',
      (q) => q.like('account_code', '42%')
    );

    const ccItems = journalItems42
      .filter(i => journalIds2025.has(i.journal_id as string))
      .map(i => {
        const j = journals2025.find(x => x.id === i.journal_id);
        return {
          source: 'CC',
          doc: (j?.name as string) || '',
          date: (j?.date as string) || '',
          account_code: i.account_code as string,
          movement: i.movement as string,
          value: Number(i.value) || 0,
          description: (i.description as string) || '',
        };
      })
      .sort((a, b) => b.value - a.value);

    // Purchases (FC)
    const purchases = await fetchAllRows('purchases', 'id, date, name, supplier_name');
    const purchases2025 = purchases.filter(p => (p.date as string)?.startsWith('2025'));
    const purchaseIds2025 = new Set(purchases2025.map(p => p.id as string));

    const purchaseItems42 = await fetchAllRows(
      'purchase_items',
      'account_code, price, quantity, purchase_id, description',
      (q) => q.like('account_code', '42%')
    );

    const fcItems = purchaseItems42
      .filter(i => purchaseIds2025.has(i.purchase_id as string))
      .map(i => {
        const p = purchases2025.find(x => x.id === i.purchase_id);
        return {
          source: 'FC',
          doc: (p?.name as string) || '',
          date: (p?.date as string) || '',
          supplier: (p?.supplier_name as string) || '',
          account_code: i.account_code as string,
          total: (Number(i.price) || 0) * (Number(i.quantity) || 1),
          description: (i.description as string) || '',
        };
      })
      .sort((a, b) => b.total - a.total);

    // Summary
    const ccCredit = ccItems.filter(i => i.movement === 'Credit').reduce((s, i) => s + i.value, 0);
    const ccDebit = ccItems.filter(i => i.movement === 'Debit').reduce((s, i) => s + i.value, 0);
    const fcTotal = fcItems.reduce((s, i) => s + i.total, 0);

    return NextResponse.json({
      investigation: 'Otros Ingresos (42) — 2025 completo desde DB',
      summary: {
        cc_credit: Math.round(ccCredit),
        cc_debit: Math.round(ccDebit),
        fc_total: Math.round(fcTotal),
        db_net: Math.round(ccCredit - ccDebit - fcTotal),
        bp_total: 24772880,
      },
      cc_items: ccItems,
      cc_count: ccItems.length,
      fc_items: fcItems,
      fc_count: fcItems.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
