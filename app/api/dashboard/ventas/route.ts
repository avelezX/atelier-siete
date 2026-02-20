import { NextRequest, NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

// Fetch all rows from a table, handling Supabase's 1000 row default limit
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

export const maxDuration = 60;

// GET /api/dashboard/ventas?month=2026-02
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const monthParam = searchParams.get('month'); // YYYY-MM

  try {
    // 1. Get available months from invoices
    const allInvoiceDates = await fetchAllRows('invoices', 'date', (q) =>
      q.eq('annulled', false).order('date', { ascending: false })
    );

    const monthSet = new Set<string>();
    allInvoiceDates.forEach((inv) => {
      const d = inv.date as string;
      if (d) monthSet.add(d.substring(0, 7));
    });
    const availableMonths = Array.from(monthSet).sort().reverse();

    const selectedMonth =
      monthParam || availableMonths[0] || new Date().toISOString().substring(0, 7);

    // Date range for selected month
    const startDate = `${selectedMonth}-01`;
    const [year, mon] = selectedMonth.split('-').map(Number);
    const nextMonth =
      mon === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(mon + 1).padStart(2, '0')}-01`;

    // 2. Invoices for the month
    const invoices = await fetchAllRows('invoices', '*', (q) =>
      q
        .gte('date', startDate)
        .lt('date', nextMonth)
        .eq('annulled', false)
        .order('date', { ascending: false })
    );

    // 3. Credit notes for the month
    const creditNotes = await fetchAllRows('credit_notes', '*', (q) =>
      q.gte('date', startDate).lt('date', nextMonth).order('date', { ascending: false })
    );

    // 4. Invoice items for those invoices
    const invoiceIds = invoices.map((i) => i.id as string);
    let allItems: Record<string, unknown>[] = [];
    for (let i = 0; i < invoiceIds.length; i += 200) {
      const batch = invoiceIds.slice(i, i + 200);
      const items = await fetchAllRows('invoice_items', '*', (q) =>
        q.in('invoice_id', batch)
      );
      allItems = allItems.concat(items);
    }

    // 5. Products for supplier mapping
    const products = await fetchAllRows(
      'products',
      'id, code, supplier_name, supplier_id, account_group_name'
    );

    const productMap = new Map<
      string,
      { supplier_name: string | null; is_consignment: boolean }
    >();
    products.forEach((p) => {
      const info = {
        supplier_name: (p.supplier_name as string) || null,
        is_consignment: p.account_group_name === 'Productos en Consignación',
      };
      productMap.set(p.id as string, info);
      productMap.set(p.code as string, info);
    });

    // 6. Build invoice balance map (for paid vs pending)
    const invoiceBalanceMap = new Map<string, number>();
    invoices.forEach((inv) => {
      invoiceBalanceMap.set(inv.id as string, Number(inv.balance) || 0);
    });

    // 7. Aggregate by supplier + type
    interface SupplierAgg {
      supplier_name: string;
      is_consignment: boolean;
      subtotal: number;
      iva: number;
      total: number;
      iva_paid: number;
      iva_pending: number;
      items_count: number;
      quantity: number;
    }

    const supplierAgg = new Map<string, SupplierAgg>();

    for (const item of allItems) {
      const productInfo =
        productMap.get(item.product_id as string) ||
        productMap.get(item.product_code as string);

      const supplierName = productInfo?.supplier_name || 'SIN PROVEEDOR';
      const isConsignment = productInfo?.is_consignment || false;
      const key = `${supplierName}|${isConsignment}`;

      const current = supplierAgg.get(key) || {
        supplier_name: supplierName,
        is_consignment: isConsignment,
        subtotal: 0,
        iva: 0,
        total: 0,
        iva_paid: 0,
        iva_pending: 0,
        items_count: 0,
        quantity: 0,
      };

      const lineTotal = Number(item.line_total) || 0;
      const taxValue = Number(item.tax_value) || 0;
      const invoiceBalance = invoiceBalanceMap.get(item.invoice_id as string) ?? 0;
      const isPaid = invoiceBalance <= 0;

      current.total += lineTotal;
      current.iva += taxValue;
      current.subtotal += lineTotal - taxValue;
      current.items_count += 1;
      current.quantity += Number(item.quantity) || 0;

      if (isPaid) {
        current.iva_paid += taxValue;
      } else {
        current.iva_pending += taxValue;
      }

      supplierAgg.set(key, current);
    }

    const bySupplier = Array.from(supplierAgg.values()).sort(
      (a, b) => b.total - a.total
    );

    // 8. Summary from invoice headers
    const totalVentas = invoices.reduce(
      (sum, i) => sum + (Number(i.total) || 0),
      0
    );
    const totalSubtotal = invoices.reduce(
      (sum, i) => sum + (Number(i.subtotal) || 0),
      0
    );
    const totalIva = invoices.reduce(
      (sum, i) => sum + (Number(i.tax_amount) || 0),
      0
    );
    const totalBalance = invoices.reduce(
      (sum, i) => sum + (Number(i.balance) || 0),
      0
    );
    const totalCreditNotes = creditNotes.reduce(
      (sum, cn) => sum + (Number(cn.total) || 0),
      0
    );

    const consignmentTotal = bySupplier
      .filter((s) => s.is_consignment)
      .reduce((sum, s) => sum + s.total, 0);
    const ownTotal = bySupplier
      .filter((s) => !s.is_consignment)
      .reduce((sum, s) => sum + s.total, 0);

    const summary = {
      total_ventas: totalVentas,
      total_subtotal: totalSubtotal,
      total_iva: totalIva,
      total_invoices: invoices.length,
      total_balance: totalBalance,
      total_credit_notes: totalCreditNotes,
      credit_notes_count: creditNotes.length,
      consignment_total: consignmentTotal,
      own_total: ownTotal,
      neto: totalVentas - totalCreditNotes,
    };

    // 9. Invoice list (simplified)
    const invoiceList = invoices.map((inv) => ({
      id: inv.id,
      name: inv.name,
      date: inv.date,
      customer_name: inv.customer_name,
      subtotal: inv.subtotal,
      tax_amount: inv.tax_amount,
      total: inv.total,
      balance: inv.balance,
    }));

    return NextResponse.json({
      month: selectedMonth,
      available_months: availableMonths,
      summary,
      by_supplier: bySupplier,
      invoices: invoiceList,
      items_analyzed: allItems.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
