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

// GET /api/dashboard/costo-cero?start=2025-01&end=2025-12
// GET /api/dashboard/costo-cero?month=2025-12
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const monthParam = params.get('month');
  const startParam = params.get('start');
  const endParam = params.get('end');

  try {
    // Determine date range
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
      // Default: last 12 months
      const now = new Date();
      const endY = now.getFullYear();
      const endM = now.getMonth() + 1;
      const startD = new Date(endY, endM - 12, 1);
      startDate = `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, '0')}-01`;
      endDate = `${endY}-${String(endM + 1).padStart(2, '0')}-01`;
      label = 'Ultimos 12 meses';
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
    const invoices = await fetchAllRows('invoices', 'id, date, name, customer_name, total', (q) =>
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

    // 4. Journals in range
    const journals = await fetchAllRows('journals', 'id, date', (q) =>
      q.gte('date', startDate).lt('date', endDate)
    );
    const journalIds = journals.map((j) => j.id as string);

    // 5. COGS items (6135)
    let cogsItems: Record<string, unknown>[] = [];
    for (let i = 0; i < journalIds.length; i += 200) {
      const batch = journalIds.slice(i, i + 200);
      const items = await fetchAllRows('journal_items', 'product_code, value, journal_id', (q) =>
        q.in('journal_id', batch).like('account_code', '6135%').eq('movement', 'Debit')
      );
      cogsItems = cogsItems.concat(items);
    }

    // 6. Products
    const products = await fetchAllRows('products', 'id, code, name, supplier_name, account_group_name, siigo_id');

    const productMap = new Map<string, {
      name: string;
      code: string;
      supplier_name: string | null;
      is_consignment: boolean;
      siigo_id: string | null;
    }>();
    products.forEach((p) => {
      const info = {
        name: p.name as string,
        code: p.code as string,
        supplier_name: (p.supplier_name as string) || null,
        is_consignment: p.account_group_name === 'Productos en Consignación',
        siigo_id: (p.siigo_id as string) || null,
      };
      productMap.set(p.id as string, info);
      productMap.set(p.code as string, info);
    });

    // 7. COGS set — products that have cost
    const cogsProductCodes = new Set<string>();
    cogsItems.forEach((item) => {
      const code = item.product_code as string;
      if (code) cogsProductCodes.add(code);
    });

    // 8. Build invoice-to-date map for monthly breakdown
    const invoiceDateMap = new Map<string, string>();
    invoices.forEach((inv) => {
      invoiceDateMap.set(inv.id as string, (inv.date as string)?.substring(0, 7) || '');
    });

    // 9. Aggregate sales by product — only those with NO cost
    interface ZeroCostProduct {
      product_code: string;
      product_name: string;
      supplier_name: string;
      is_consignment: boolean;
      quantity_sold: number;
      revenue: number;
      iva: number;
      revenue_with_iva: number;
      estimated_cost_70: number;
      invoices_count: number;
      months_sold: string[];
      customers: string[];
    }

    const salesByProduct = new Map<string, ZeroCostProduct>();
    const invoiceCustomerMap = new Map<string, string>();
    invoices.forEach((inv) => {
      invoiceCustomerMap.set(inv.id as string, (inv.customer_name as string) || '');
    });

    for (const item of allItems) {
      const code = (item.product_code as string) || 'SIN_CODIGO';

      // Skip products that DO have COGS
      if (cogsProductCodes.has(code)) continue;

      const productInfo = productMap.get(item.product_id as string) || productMap.get(code);
      const invoiceMonth = invoiceDateMap.get(item.invoice_id as string) || '';
      const customer = invoiceCustomerMap.get(item.invoice_id as string) || '';

      const curr = salesByProduct.get(code) || {
        product_code: code,
        product_name: (item.product_name as string) || productInfo?.name || code,
        supplier_name: productInfo?.supplier_name || 'SIN PROVEEDOR',
        is_consignment: productInfo?.is_consignment || false,
        quantity_sold: 0,
        revenue: 0,
        iva: 0,
        revenue_with_iva: 0,
        estimated_cost_70: 0,
        invoices_count: 0,
        months_sold: [],
        customers: [],
      };

      const lineTotal = Number(item.line_total) || 0;
      const taxValue = Number(item.tax_value) || 0;
      curr.quantity_sold += Number(item.quantity) || 0;
      curr.revenue += lineTotal - taxValue;
      curr.iva += taxValue;
      curr.revenue_with_iva += lineTotal;
      curr.invoices_count += 1;
      if (invoiceMonth && curr.months_sold.indexOf(invoiceMonth) === -1) {
        curr.months_sold.push(invoiceMonth);
      }
      if (customer && curr.customers.indexOf(customer) === -1) {
        curr.customers.push(customer);
      }

      salesByProduct.set(code, curr);
    }

    // Calculate estimated cost (70% of revenue)
    for (const [, sale] of salesByProduct) {
      sale.estimated_cost_70 = sale.revenue * 0.7;
    }

    const zeroCostProducts = Array.from(salesByProduct.values()).sort((a, b) => b.revenue - a.revenue);

    // 10. By supplier
    interface SupplierAgg {
      supplier_name: string;
      is_consignment: boolean;
      products_count: number;
      revenue: number;
      estimated_cost: number;
      quantity: number;
    }
    const supplierAgg = new Map<string, SupplierAgg>();
    for (const p of zeroCostProducts) {
      const key = p.supplier_name;
      const curr = supplierAgg.get(key) || {
        supplier_name: p.supplier_name,
        is_consignment: p.is_consignment,
        products_count: 0,
        revenue: 0,
        estimated_cost: 0,
        quantity: 0,
      };
      curr.products_count += 1;
      curr.revenue += p.revenue;
      curr.estimated_cost += p.estimated_cost_70;
      curr.quantity += p.quantity_sold;
      supplierAgg.set(key, curr);
    }
    const by_supplier = Array.from(supplierAgg.values()).sort((a, b) => b.revenue - a.revenue);

    // 11. By month
    interface MonthAgg {
      month: string;
      zero_cost_revenue: number;
      zero_cost_products: number;
      total_revenue: number;
      total_products: number;
      pct_zero: number;
    }
    const monthRevenue = new Map<string, { zero: number; zeroProd: Set<string>; total: number; totalProd: Set<string> }>();
    for (const item of allItems) {
      const invoiceMonth = invoiceDateMap.get(item.invoice_id as string) || '';
      if (invoiceMonth === '') continue;
      const code = (item.product_code as string) || 'SIN_CODIGO';
      const lineTotal = Number(item.line_total) || 0;
      const taxValue = Number(item.tax_value) || 0;
      const rev = lineTotal - taxValue;

      const curr = monthRevenue.get(invoiceMonth) || { zero: 0, zeroProd: new Set(), total: 0, totalProd: new Set() };
      curr.total += rev;
      curr.totalProd.add(code);
      if (cogsProductCodes.has(code) === false) {
        curr.zero += rev;
        curr.zeroProd.add(code);
      }
      monthRevenue.set(invoiceMonth, curr);
    }
    const by_month: MonthAgg[] = Array.from(monthRevenue.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, d]) => ({
        month,
        zero_cost_revenue: d.zero,
        zero_cost_products: d.zeroProd.size,
        total_revenue: d.total,
        total_products: d.totalProd.size,
        pct_zero: d.total > 0 ? (d.zero / d.total) * 100 : 0,
      }));

    // 12. Totals
    const totalRevenue = zeroCostProducts.reduce((s, p) => s + p.revenue, 0);
    const totalEstCost = zeroCostProducts.reduce((s, p) => s + p.estimated_cost_70, 0);
    const totalAllRevenue = allItems.reduce((s, item) => {
      const lt = Number(item.line_total) || 0;
      const tv = Number(item.tax_value) || 0;
      return s + (lt - tv);
    }, 0);

    return NextResponse.json({
      label,
      start: startDate,
      end: endDate,
      available_months,
      products: zeroCostProducts,
      by_supplier,
      by_month,
      totals: {
        zero_cost_products: zeroCostProducts.length,
        zero_cost_revenue: totalRevenue,
        estimated_cost_70: totalEstCost,
        total_products_sold: new Set(allItems.map((i) => (i.product_code as string) || '')).size,
        total_revenue: totalAllRevenue,
        pct_zero_revenue: totalAllRevenue > 0 ? (totalRevenue / totalAllRevenue) * 100 : 0,
        products_with_cogs: cogsProductCodes.size,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
