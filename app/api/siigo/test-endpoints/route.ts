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
    // === Arrendamientos (5120) + Gastos Personal (5105) — Dic 2025 desde DB ===

    const purchases = await fetchAllRows('purchases', 'id, date, name, supplier_name, supplier_identification');
    const decPurchases = purchases.filter(p => (p.date as string)?.startsWith('2025-12'));
    const decPurchaseIds = new Set(decPurchases.map(p => p.id as string));

    // Arrendamientos
    const arrItems = await fetchAllRows(
      'purchase_items',
      'account_code, price, quantity, purchase_id, description',
      (q) => q.like('account_code', '5120%')
    );
    const decArrItems = arrItems
      .filter(i => decPurchaseIds.has(i.purchase_id as string))
      .map(i => {
        const p = decPurchases.find(x => x.id === i.purchase_id);
        return {
          invoice: (p?.name as string) || '',
          date: (p?.date as string) || '',
          supplier: (p?.supplier_name as string) || '',
          nit: (p?.supplier_identification as string) || '',
          account_code: i.account_code as string,
          price: Number(i.price) || 0,
          quantity: Number(i.quantity) || 1,
          total: (Number(i.price) || 0) * (Number(i.quantity) || 1),
          description: (i.description as string) || '',
        };
      })
      .sort((a, b) => b.total - a.total);

    // Gastos de personal
    const persItems = await fetchAllRows(
      'purchase_items',
      'account_code, price, quantity, purchase_id, description',
      (q) => q.like('account_code', '5105%')
    );
    const decPersItems = persItems
      .filter(i => decPurchaseIds.has(i.purchase_id as string))
      .map(i => {
        const p = decPurchases.find(x => x.id === i.purchase_id);
        return {
          invoice: (p?.name as string) || '',
          date: (p?.date as string) || '',
          supplier: (p?.supplier_name as string) || '',
          nit: (p?.supplier_identification as string) || '',
          account_code: i.account_code as string,
          price: Number(i.price) || 0,
          quantity: Number(i.quantity) || 1,
          total: (Number(i.price) || 0) * (Number(i.quantity) || 1),
          description: (i.description as string) || '',
        };
      })
      .sort((a, b) => b.total - a.total);

    // Also check journals for both
    const journals = await fetchAllRows('journals', 'id, name, date');
    const decJournals = journals.filter(j => (j.date as string)?.startsWith('2025-12'));
    const decJournalIds = new Set(decJournals.map(j => j.id as string));

    const arrJournalItems = await fetchAllRows(
      'journal_items',
      'account_code, movement, value, journal_id, description',
      (q) => q.like('account_code', '5120%')
    );
    const decArrJournals = arrJournalItems
      .filter(i => decJournalIds.has(i.journal_id as string))
      .map(i => {
        const j = decJournals.find(x => x.id === i.journal_id);
        return {
          journal: (j?.name as string) || '',
          date: (j?.date as string) || '',
          account_code: i.account_code as string,
          movement: i.movement as string,
          value: Number(i.value) || 0,
          description: (i.description as string) || '',
        };
      });

    const persJournalItems = await fetchAllRows(
      'journal_items',
      'account_code, movement, value, journal_id, description',
      (q) => q.like('account_code', '5105%')
    );
    const decPersJournals = persJournalItems
      .filter(i => decJournalIds.has(i.journal_id as string))
      .map(i => {
        const j = decJournals.find(x => x.id === i.journal_id);
        return {
          journal: (j?.name as string) || '',
          date: (j?.date as string) || '',
          account_code: i.account_code as string,
          movement: i.movement as string,
          value: Number(i.value) || 0,
          description: (i.description as string) || '',
        };
      });

    return NextResponse.json({
      investigation: 'Dic 2025 — Arrendamientos (5120) + Gastos Personal (5105) desde DB',
      arrendamientos: {
        fc_items: decArrItems,
        fc_total: Math.round(decArrItems.reduce((s, i) => s + i.total, 0)),
        cc_items: decArrJournals,
        cc_debit: Math.round(decArrJournals.filter(i => i.movement === 'Debit').reduce((s, i) => s + i.value, 0)),
      },
      gastos_personal: {
        fc_items: decPersItems,
        fc_total: Math.round(decPersItems.reduce((s, i) => s + i.total, 0)),
        cc_items: decPersJournals,
        cc_debit: Math.round(decPersJournals.filter(i => i.movement === 'Debit').reduce((s, i) => s + i.value, 0)),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
