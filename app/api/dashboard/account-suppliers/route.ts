import { NextRequest, NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

export const maxDuration = 30;

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

// GET /api/dashboard/account-suppliers?prefix=5145&year=2025
export async function GET(req: NextRequest) {
  try {
    const prefix = req.nextUrl.searchParams.get('prefix') || '';
    const year = parseInt(req.nextUrl.searchParams.get('year') || '2025');

    if (!prefix || prefix.length < 2) {
      return NextResponse.json({ error: 'prefix (2-4 digits) required' }, { status: 400 });
    }

    // Purchases (FC) with this account prefix
    const purchases = await fetchAllRows('purchases', 'id, date, name, supplier_name');
    const yearPurchases = purchases.filter(p => (p.date as string)?.startsWith(String(year)));
    const purchaseMap = new Map(yearPurchases.map(p => [p.id as string, p]));
    const purchaseIds = new Set(yearPurchases.map(p => p.id as string));

    const purchaseItems = await fetchAllRows(
      'purchase_items',
      'account_code, price, quantity, purchase_id, description',
      (q) => q.like('account_code', `${prefix}%`)
    );

    // Journals (CC) with this account prefix
    const journals = await fetchAllRows('journals', 'id, date, name');
    const yearJournals = journals.filter(j => (j.date as string)?.startsWith(String(year)));
    const journalMap = new Map(yearJournals.map(j => [j.id as string, j]));
    const journalIds = new Set(yearJournals.map(j => j.id as string));

    const journalItems = await fetchAllRows(
      'journal_items',
      'account_code, movement, value, journal_id, description',
      (q) => q.like('account_code', `${prefix}%`)
    );

    // Build monthly supplier breakdown
    interface SupplierEntry {
      supplier: string;
      amount: number;
      invoices: string[];
    }

    const monthlyData = new Map<string, Map<string, SupplierEntry>>();

    // Process purchase items
    for (const item of purchaseItems) {
      if (!purchaseIds.has(item.purchase_id as string)) continue;
      const purchase = purchaseMap.get(item.purchase_id as string);
      if (!purchase) continue;
      const month = (purchase.date as string)?.substring(0, 7);
      if (!month) continue;

      const supplier = (purchase.supplier_name as string) || 'Sin proveedor';
      const total = (Number(item.price) || 0) * (Number(item.quantity) || 1);
      const invoice = (purchase.name as string) || '';

      if (!monthlyData.has(month)) monthlyData.set(month, new Map());
      const suppliers = monthlyData.get(month)!;
      if (!suppliers.has(supplier)) suppliers.set(supplier, { supplier, amount: 0, invoices: [] });
      const entry = suppliers.get(supplier)!;
      entry.amount += total;
      if (invoice && !entry.invoices.includes(invoice)) entry.invoices.push(invoice);
    }

    // Process journal items (debit = expense)
    for (const item of journalItems) {
      if (!journalIds.has(item.journal_id as string)) continue;
      const journal = journalMap.get(item.journal_id as string);
      if (!journal) continue;
      const month = (journal.date as string)?.substring(0, 7);
      if (!month) continue;

      if (item.movement !== 'Debit') continue;

      const supplier = (item.description as string) || 'Comprobante contable';
      const value = Number(item.value) || 0;
      const doc = (journal.name as string) || '';

      if (!monthlyData.has(month)) monthlyData.set(month, new Map());
      const suppliers = monthlyData.get(month)!;
      if (!suppliers.has(supplier)) suppliers.set(supplier, { supplier, amount: 0, invoices: [] });
      const entry = suppliers.get(supplier)!;
      entry.amount += value;
      if (doc && !entry.invoices.includes(doc)) entry.invoices.push(doc);
    }

    // Format response: { "2025-01": [{ supplier, amount, invoices }], ... }
    const result: Record<string, SupplierEntry[]> = {};
    for (const [month, suppliers] of Array.from(monthlyData.entries()).sort(([a], [b]) => a.localeCompare(b))) {
      result[month] = Array.from(suppliers.values())
        .map(s => ({ ...s, amount: Math.round(s.amount) }))
        .sort((a, b) => b.amount - a.amount);
    }

    // Also compute yearly totals by supplier
    const yearlySuppliers = new Map<string, SupplierEntry>();
    for (const suppliers of monthlyData.values()) {
      for (const [name, entry] of suppliers.entries()) {
        if (!yearlySuppliers.has(name)) yearlySuppliers.set(name, { supplier: name, amount: 0, invoices: [] });
        const yearly = yearlySuppliers.get(name)!;
        yearly.amount += entry.amount;
        for (const inv of entry.invoices) {
          if (!yearly.invoices.includes(inv)) yearly.invoices.push(inv);
        }
      }
    }

    return NextResponse.json({
      prefix,
      year,
      by_month: result,
      yearly_totals: Array.from(yearlySuppliers.values())
        .map(s => ({ ...s, amount: Math.round(s.amount) }))
        .sort((a, b) => b.amount - a.amount),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
