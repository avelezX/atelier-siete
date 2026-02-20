import { NextRequest, NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

// Fetch all rows handling Supabase 1000 row limit
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

// GET /api/dashboard/resumen/mes?month=2025-12
export async function GET(request: NextRequest) {
  const monthParam = request.nextUrl.searchParams.get('month');

  if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
    return NextResponse.json({ error: 'Parametro month requerido (YYYY-MM)' }, { status: 400 });
  }

  try {
    const startDate = `${monthParam}-01`;
    const [year, mon] = monthParam.split('-').map(Number);
    const nextMonth =
      mon === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(mon + 1).padStart(2, '0')}-01`;

    // 1. Invoices for the month
    const invoices = await fetchAllRows('invoices', 'id, name, date, customer_name, total, subtotal, tax_amount, balance, annulled', (q) =>
      q.gte('date', startDate).lt('date', nextMonth).eq('annulled', false)
    );

    // 2. Invoice items for those invoices
    const invoiceIds = invoices.map((i) => i.id as string);
    let allItems: Record<string, unknown>[] = [];
    for (let i = 0; i < invoiceIds.length; i += 200) {
      const batch = invoiceIds.slice(i, i + 200);
      const items = await fetchAllRows('invoice_items', '*', (q) =>
        q.in('invoice_id', batch)
      );
      allItems = allItems.concat(items);
    }

    // 3. Journal items for COGS (6135) in this month
    const journals = await fetchAllRows('journals', 'id, date', (q) =>
      q.gte('date', startDate).lt('date', nextMonth)
    );
    const journalIds = journals.map((j) => j.id as string);

    let cogsItems: Record<string, unknown>[] = [];
    for (let i = 0; i < journalIds.length; i += 200) {
      const batch = journalIds.slice(i, i + 200);
      const items = await fetchAllRows('journal_items', 'product_code, product_name, product_quantity, value, movement, account_code, journal_id', (q) =>
        q.in('journal_id', batch).like('account_code', '6135%').eq('movement', 'Debit')
      );
      cogsItems = cogsItems.concat(items);
    }

    // 4. Products for supplier info
    const products = await fetchAllRows(
      'products',
      'id, code, name, supplier_name, account_group_name'
    );

    const productMap = new Map<string, {
      name: string;
      supplier_name: string | null;
      is_consignment: boolean;
    }>();
    products.forEach((p) => {
      const info = {
        name: p.name as string,
        supplier_name: (p.supplier_name as string) || null,
        is_consignment: p.account_group_name === 'Productos en Consignación',
      };
      productMap.set(p.id as string, info);
      productMap.set(p.code as string, info);
    });

    // 5. Build COGS by product code
    const cogsByProduct = new Map<string, { cost: number; quantity: number }>();
    cogsItems.forEach((item) => {
      const code = (item.product_code as string) || 'SIN_CODIGO';
      const curr = cogsByProduct.get(code) || { cost: 0, quantity: 0 };
      curr.cost += Number(item.value) || 0;
      curr.quantity += Number(item.product_quantity) || 0;
      cogsByProduct.set(code, curr);
    });

    // 6. Aggregate sales by product
    interface ProductSale {
      product_code: string;
      product_name: string;
      supplier_name: string;
      is_consignment: boolean;
      quantity_sold: number;
      revenue: number;
      iva: number;
      cogs: number;
      cogs_quantity: number;
      margin: number;
      margin_pct: number;
    }

    const salesByProduct = new Map<string, ProductSale>();

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
        cogs: 0,
        cogs_quantity: 0,
        margin: 0,
        margin_pct: 0,
      };

      const lineTotal = Number(item.line_total) || 0;
      const taxValue = Number(item.tax_value) || 0;
      curr.quantity_sold += Number(item.quantity) || 0;
      curr.revenue += lineTotal - taxValue;
      curr.iva += taxValue;

      salesByProduct.set(code, curr);
    }

    // Merge COGS into sales
    for (const [code, sale] of salesByProduct) {
      const cogs = cogsByProduct.get(code);
      if (cogs) {
        sale.cogs = cogs.cost;
        sale.cogs_quantity = cogs.quantity;
      }
      sale.margin = sale.revenue - sale.cogs;
      sale.margin_pct = sale.revenue > 0 ? (sale.margin / sale.revenue) * 100 : 0;
    }

    // Also add COGS-only products (cost but no sale this month)
    for (const [code, cogs] of cogsByProduct) {
      if (!salesByProduct.has(code)) {
        const productInfo = productMap.get(code);
        salesByProduct.set(code, {
          product_code: code,
          product_name: productInfo?.name || code,
          supplier_name: productInfo?.supplier_name || 'SIN PROVEEDOR',
          is_consignment: productInfo?.is_consignment || false,
          quantity_sold: 0,
          revenue: 0,
          iva: 0,
          cogs: cogs.cost,
          cogs_quantity: cogs.quantity,
          margin: -cogs.cost,
          margin_pct: 0,
        });
      }
    }

    const productList = Array.from(salesByProduct.values()).sort((a, b) => b.revenue - a.revenue);

    // 7. Totals
    const totals = productList.reduce(
      (acc, p) => ({
        quantity_sold: acc.quantity_sold + p.quantity_sold,
        revenue: acc.revenue + p.revenue,
        iva: acc.iva + p.iva,
        cogs: acc.cogs + p.cogs,
        margin: acc.margin + p.margin,
      }),
      { quantity_sold: 0, revenue: 0, iva: 0, cogs: 0, margin: 0 }
    );

    // 8. By supplier summary
    const supplierMap = new Map<string, {
      supplier_name: string;
      is_consignment: boolean;
      revenue: number;
      cogs: number;
      margin: number;
      products_count: number;
    }>();

    for (const p of productList) {
      const key = p.supplier_name;
      const curr = supplierMap.get(key) || {
        supplier_name: p.supplier_name,
        is_consignment: p.is_consignment,
        revenue: 0,
        cogs: 0,
        margin: 0,
        products_count: 0,
      };
      curr.revenue += p.revenue;
      curr.cogs += p.cogs;
      curr.margin += p.margin;
      curr.products_count += 1;
      supplierMap.set(key, curr);
    }

    const bySupplier = Array.from(supplierMap.values())
      .map((s) => ({
        ...s,
        margin_pct: s.revenue > 0 ? (s.margin / s.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({
      month: monthParam,
      products: productList,
      by_supplier: bySupplier,
      totals: {
        ...totals,
        margin_pct: totals.revenue > 0 ? (totals.margin / totals.revenue) * 100 : 0,
      },
      counts: {
        invoices: invoices.length,
        invoice_items: allItems.length,
        cogs_items: cogsItems.length,
        products_with_sales: productList.filter((p) => p.revenue > 0).length,
        products_with_cogs: productList.filter((p) => p.cogs > 0).length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
