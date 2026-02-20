import { NextRequest, NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

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

// GET /api/dashboard/costos-estimados?month=2025-12
// GET /api/dashboard/costos-estimados?start=2025-01&end=2025-12
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const monthParam = params.get('month');
  const startParam = params.get('start');
  const endParam = params.get('end');

  try {
    let startDate: string;
    let endDate: string;
    let label: string;

    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      startDate = `${monthParam}-01`;
      const [y, m] = monthParam.split('-').map(Number);
      endDate = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
      label = monthParam;
    } else if (startParam && endParam) {
      startDate = `${startParam}-01`;
      const [y, m] = endParam.split('-').map(Number);
      endDate = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
      label = `${startParam} a ${endParam}`;
    } else {
      // Default: current month
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      const mm = String(m).padStart(2, '0');
      startDate = `${y}-${mm}-01`;
      endDate = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
      label = `${y}-${mm}`;
    }

    // 1. Available months
    const allInvoiceDates = await fetchAllRows('invoices', 'date', (q) =>
      q.eq('annulled', false).order('date', { ascending: false })
    );
    const monthSet = new Set<string>();
    allInvoiceDates.forEach((inv) => {
      const d = inv.date as string;
      if (d) monthSet.add(d.substring(0, 7));
    });
    const available_months = Array.from(monthSet).sort().reverse();

    // 2. Invoices in range
    const invoices = await fetchAllRows('invoices', 'id, date, name, customer_name', (q) =>
      q.gte('date', startDate).lt('date', endDate).eq('annulled', false)
    );

    // 3. Invoice items
    const invoiceIds = invoices.map((i) => i.id as string);
    let allItems: Record<string, unknown>[] = [];
    for (let i = 0; i < invoiceIds.length; i += 200) {
      const batch = invoiceIds.slice(i, i + 200);
      const items = await fetchAllRows('invoice_items', '*', (q) => q.in('invoice_id', batch));
      allItems = allItems.concat(items);
    }

    // 4. Journals in range for actual COGS
    const journals = await fetchAllRows('journals', 'id, date', (q) =>
      q.gte('date', startDate).lt('date', endDate)
    );
    const journalIds = journals.map((j) => j.id as string);

    let cogsItems: Record<string, unknown>[] = [];
    for (let i = 0; i < journalIds.length; i += 200) {
      const batch = journalIds.slice(i, i + 200);
      const items = await fetchAllRows('journal_items', 'product_code, value, journal_id', (q) =>
        q.in('journal_id', batch).like('account_code', '6135%').eq('movement', 'Debit')
      );
      cogsItems = cogsItems.concat(items);
    }

    // 5. Products
    const products = await fetchAllRows('products', 'id, code, name, supplier_name, account_group_name');
    const productMap = new Map<string, {
      name: string;
      code: string;
      supplier_name: string | null;
      is_consignment: boolean;
    }>();
    products.forEach((p) => {
      const info = {
        name: p.name as string,
        code: p.code as string,
        supplier_name: (p.supplier_name as string) || null,
        is_consignment: p.account_group_name === 'Productos en Consignación',
      };
      productMap.set(p.id as string, info);
      productMap.set(p.code as string, info);
    });

    // 6. Actual COGS by product
    const actualCogsByProduct = new Map<string, number>();
    cogsItems.forEach((item) => {
      const code = (item.product_code as string) || '';
      if (code) actualCogsByProduct.set(code, (actualCogsByProduct.get(code) || 0) + (Number(item.value) || 0));
    });

    // 7. Aggregate sales by product
    interface ProductRow {
      product_code: string;
      product_name: string;
      supplier_name: string;
      is_consignment: boolean;
      quantity_sold: number;
      revenue: number; // subtotal sin IVA
      iva: number;
      actual_cost: number;
      estimated_cost: number; // revenue * 0.7
      difference: number; // estimated - actual
      status: 'ok' | 'missing' | 'over' | 'under';
    }

    const salesByProduct = new Map<string, ProductRow>();

    for (const item of allItems) {
      const code = (item.product_code as string) || 'SIN_CODIGO';
      const productInfo = productMap.get(item.product_id as string) || productMap.get(code);

      const curr = salesByProduct.get(code) || {
        product_code: code,
        product_name: (item.product_name as string) || productInfo?.name || code,
        supplier_name: productInfo?.supplier_name || 'SIN PROVEEDOR',
        is_consignment: productInfo?.is_consignment || false,
        quantity_sold: 0,
        revenue: 0,
        iva: 0,
        actual_cost: 0,
        estimated_cost: 0,
        difference: 0,
        status: 'missing' as const,
      };

      const lineTotal = Number(item.line_total) || 0;
      const taxValue = Number(item.tax_value) || 0;
      curr.quantity_sold += Number(item.quantity) || 0;
      curr.revenue += lineTotal - taxValue;
      curr.iva += taxValue;

      salesByProduct.set(code, curr);
    }

    // Merge actual costs and calculate estimated
    for (const [code, row] of salesByProduct) {
      row.estimated_cost = row.revenue * 0.7;
      const actual = actualCogsByProduct.get(code) || 0;
      row.actual_cost = actual;
      row.difference = row.estimated_cost - actual;

      if (actual === 0) {
        row.status = 'missing';
      } else {
        const ratio = actual / row.estimated_cost;
        if (ratio >= 0.85 && ratio <= 1.15) {
          row.status = 'ok';
        } else if (actual > row.estimated_cost) {
          row.status = 'over';
        } else {
          row.status = 'under';
        }
      }
    }

    const productList = Array.from(salesByProduct.values()).sort((a, b) => b.revenue - a.revenue);

    // 8. By supplier
    interface SupplierAgg {
      supplier_name: string;
      is_consignment: boolean;
      products_count: number;
      missing_count: number;
      ok_count: number;
      over_count: number;
      under_count: number;
      revenue: number;
      actual_cost: number;
      estimated_cost: number;
      difference: number;
    }
    const supplierAgg = new Map<string, SupplierAgg>();
    for (const p of productList) {
      const key = p.supplier_name;
      const curr = supplierAgg.get(key) || {
        supplier_name: p.supplier_name,
        is_consignment: p.is_consignment,
        products_count: 0,
        missing_count: 0,
        ok_count: 0,
        over_count: 0,
        under_count: 0,
        revenue: 0,
        actual_cost: 0,
        estimated_cost: 0,
        difference: 0,
      };
      curr.products_count++;
      curr.revenue += p.revenue;
      curr.actual_cost += p.actual_cost;
      curr.estimated_cost += p.estimated_cost;
      curr.difference += p.difference;
      if (p.status === 'missing') curr.missing_count++;
      else if (p.status === 'ok') curr.ok_count++;
      else if (p.status === 'over') curr.over_count++;
      else curr.under_count++;
      supplierAgg.set(key, curr);
    }
    const by_supplier = Array.from(supplierAgg.values()).sort((a, b) => b.revenue - a.revenue);

    // 9. Totals
    const missing = productList.filter(p => p.status === 'missing');
    const totalRevenue = productList.reduce((s, p) => s + p.revenue, 0);
    const totalActual = productList.reduce((s, p) => s + p.actual_cost, 0);
    const totalEstimated = productList.reduce((s, p) => s + p.estimated_cost, 0);

    return NextResponse.json({
      label,
      available_months,
      products: productList,
      by_supplier,
      totals: {
        total_products: productList.length,
        missing_count: missing.length,
        ok_count: productList.filter(p => p.status === 'ok').length,
        over_count: productList.filter(p => p.status === 'over').length,
        under_count: productList.filter(p => p.status === 'under').length,
        revenue: totalRevenue,
        actual_cost: totalActual,
        estimated_cost: totalEstimated,
        difference: totalEstimated - totalActual,
        actual_margin_pct: totalRevenue > 0 ? ((totalRevenue - totalActual) / totalRevenue) * 100 : 0,
        estimated_margin_pct: totalRevenue > 0 ? ((totalRevenue - totalEstimated) / totalRevenue) * 100 : 30,
        // What the P&L would look like with estimated costs filled in
        corrected_cost: totalActual + missing.reduce((s, p) => s + p.estimated_cost, 0),
        corrected_margin_pct: totalRevenue > 0
          ? ((totalRevenue - totalActual - missing.reduce((s, p) => s + p.estimated_cost, 0)) / totalRevenue) * 100
          : 0,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
