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

// Fuzzy supplier matching: product supplier name → purchase supplier name
function buildSupplierMatchMap(
  productSuppliers: string[],
  purchaseSuppliers: string[]
): Map<string, string> {
  const map = new Map<string, string>();
  const purchaseLowerMap = new Map(purchaseSuppliers.map(ps => [ps.toLowerCase(), ps]));

  // Exact (case-insensitive)
  for (const ps of productSuppliers) {
    const match = purchaseLowerMap.get(ps.toLowerCase());
    if (match) map.set(ps, match);
  }

  // Fuzzy (contained-in)
  for (const ps of productSuppliers) {
    if (map.has(ps)) continue;
    const psLower = ps.toLowerCase().trim();
    if (psLower.length < 3) continue;
    for (const pu of purchaseSuppliers) {
      const puLower = pu.toLowerCase().trim();
      if (puLower.includes(psLower) || psLower.includes(puLower)) {
        map.set(ps, pu);
        break;
      }
    }
  }
  return map;
}

// GET /api/dashboard/cost-tracking?start=2025-06&end=2025-12
// Returns flat product list with cost resolution status
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const startParam = params.get('start') || '2025-06';
    const endParam = params.get('end') || '2025-12';

    // Convert month params to date range
    const startDate = `${startParam}-01`;
    const [endY, endM] = endParam.split('-').map(Number);
    const endDate = endM === 12 ? `${endY + 1}-01-01` : `${endY}-${String(endM + 1).padStart(2, '0')}-01`;
    // Purchases extend 1 month past end for N+1 matching
    const purchEndM = endM === 12 ? 1 : endM + 1;
    const purchEndY = endM === 12 ? endY + 1 : endY;
    const purchEndDate = purchEndM === 12 ? `${purchEndY + 1}-01-01` : `${purchEndY}-${String(purchEndM + 1).padStart(2, '0')}-01`;

    // 1. Products
    const products = await fetchAllRows('products', 'code, name, supplier_name, sale_price');
    const productByCode = new Map(products.map(p => [p.code as string, p]));
    const productSupplierNames = [...new Set(
      products.filter(p => p.supplier_name).map(p => p.supplier_name as string)
    )];

    // 2. Invoices in range (non-annulled)
    const invoices = await fetchAllRows('invoices', 'id, date', (q) =>
      q.eq('annulled', false).gte('date', startDate).lt('date', endDate)
    );
    const invoiceDateMap = new Map(invoices.map(i => [i.id as string, (i.date as string).substring(0, 7)]));
    const invoiceIds = invoices.map(i => i.id as string);

    // 3. Invoice items (batched)
    let allInvoiceItems: Record<string, unknown>[] = [];
    for (let i = 0; i < invoiceIds.length; i += 200) {
      const batch = invoiceIds.slice(i, i + 200);
      const items = await fetchAllRows('invoice_items', 'product_code, quantity, unit_price, line_total, tax_value, invoice_id', (q) =>
        q.in('invoice_id', batch)
      );
      allInvoiceItems = allInvoiceItems.concat(items);
    }

    // 4. Purchases (extended range)
    const purchases = await fetchAllRows('purchases', 'id, date, supplier_name, subtotal', (q) =>
      q.gte('date', startDate).lt('date', purchEndDate)
    );
    const purchaseSupplierNames = [...new Set(
      purchases.filter(p => p.supplier_name).map(p => p.supplier_name as string)
    )];
    const purchaseIds = purchases.map(p => p.id as string);

    // 5. Purchase items (batched)
    let allPurchaseItems: Record<string, unknown>[] = [];
    for (let i = 0; i < purchaseIds.length; i += 200) {
      const batch = purchaseIds.slice(i, i + 200);
      const items = await fetchAllRows('purchase_items', 'purchase_id, description, quantity, price', (q) =>
        q.in('purchase_id', batch)
      );
      allPurchaseItems = allPurchaseItems.concat(items);
    }

    // 6. Existing journal items (COGS 6135) in date range - tracked per product+month
    const journals = await fetchAllRows('journals', 'id, date', (q) =>
      q.gte('date', startDate).lt('date', endDate)
    );
    const journalIds = journals.map(j => j.id as string);
    const journalMonthMap = new Map(journals.map(j => [j.id as string, (j.date as string).substring(0, 7)]));
    let cogsJournalItems: Record<string, unknown>[] = [];
    for (let i = 0; i < journalIds.length; i += 200) {
      const batch = journalIds.slice(i, i + 200);
      const items = await fetchAllRows('journal_items', 'product_code, value, journal_id', (q) =>
        q.in('journal_id', batch).like('account_code', '6135%').eq('movement', 'Debit')
      );
      cogsJournalItems = cogsJournalItems.concat(items);
    }
    // product_code::month → total COGS value (per-month tracking)
    const cogsByProductMonth = new Map<string, number>();
    for (const item of cogsJournalItems) {
      const code = item.product_code as string;
      const month = journalMonthMap.get(item.journal_id as string);
      if (!code || !month) continue;
      const key = `${code}::${month}`;
      cogsByProductMonth.set(key, (cogsByProductMonth.get(key) || 0) + ((item.value as number) || 0));
    }

    // 7. Supplier match map
    const supplierMatchMap = buildSupplierMatchMap(productSupplierNames, purchaseSupplierNames);

    // 8. Index purchase items by purchase supplier + month
    const purchaseByIdMap = new Map(purchases.map(p => [p.id as string, {
      month: (p.date as string).substring(0, 7),
      supplier: p.supplier_name as string,
    }]));

    // Group purchase items by purchase_supplier: Array<{description, qty, price, month}>
    const purchaseItemsBySuppplier = new Map<string, Array<{ description: string; qty: number; price: number; month: string }>>();
    for (const pi of allPurchaseItems) {
      const pInfo = purchaseByIdMap.get(pi.purchase_id as string);
      if (!pInfo) continue;
      if (!purchaseItemsBySuppplier.has(pInfo.supplier)) purchaseItemsBySuppplier.set(pInfo.supplier, []);
      purchaseItemsBySuppplier.get(pInfo.supplier)!.push({
        description: (pi.description as string) || '',
        qty: (pi.quantity as number) || 0,
        price: (pi.price as number) || 0,
        month: pInfo.month,
      });
    }

    // 9. Aggregate sales by product (total) and by product+month
    const salesTotalByProduct = new Map<string, { qty: number; revenue: number }>();
    const salesByProductMonth = new Map<string, { qty: number; revenue: number }>();

    for (const item of allInvoiceItems) {
      const code = item.product_code as string;
      const month = invoiceDateMap.get(item.invoice_id as string);
      if (!month) continue;
      const qty = (item.quantity as number) || 0;
      const lineTotal = (item.line_total as number) || 0;
      const taxValue = (item.tax_value as number) || 0;
      const revenue = lineTotal - taxValue;

      // Total per product (for cost resolution)
      if (!salesTotalByProduct.has(code)) salesTotalByProduct.set(code, { qty: 0, revenue: 0 });
      const total = salesTotalByProduct.get(code)!;
      total.qty += qty;
      total.revenue += revenue;

      // Per product+month (for output rows)
      const key = `${code}::${month}`;
      if (!salesByProductMonth.has(key)) salesByProductMonth.set(key, { qty: 0, revenue: 0 });
      const monthly = salesByProductMonth.get(key)!;
      monthly.qty += qty;
      monthly.revenue += revenue;
    }

    // 10a. Compute purchase cost per product (purchase matching is product-level)
    interface ProductPurchaseInfo {
      costPerUnit: number;
      qty: number;
    }
    const purchaseByProduct = new Map<string, ProductPurchaseInfo>();

    for (const [code] of salesTotalByProduct) {
      const product = productByCode.get(code);
      const supplierName = (product?.supplier_name as string) || '';
      const purchaseSupplier = supplierName ? (supplierMatchMap.get(supplierName) || null) : null;

      let purchaseCost = 0;
      let purchaseQty = 0;
      if (purchaseSupplier) {
        const supplierItems = purchaseItemsBySuppplier.get(purchaseSupplier) || [];
        const codeUpper = code.toUpperCase();
        const productName = (product?.name as string) || '';
        const nameWords = productName.split('/')[0].trim().toUpperCase();

        const seen = new Set<string>();
        for (const pi of supplierItems) {
          const desc = (pi.description || '').toUpperCase();
          if (desc.includes(codeUpper) || (nameWords.length > 5 && desc.includes(nameWords))) {
            const key = `${pi.month}-${pi.description}-${pi.price}`;
            if (seen.has(key)) continue;
            seen.add(key);
            purchaseCost += pi.price * pi.qty;
            purchaseQty += pi.qty;
          }
        }
      }

      purchaseByProduct.set(code, {
        costPerUnit: purchaseQty > 0 ? Math.round(purchaseCost / purchaseQty) : 0,
        qty: purchaseQty,
      });
    }

    // 10b. Build per-month product rows (cost source resolved per product+month)
    interface ProductRow {
      product_code: string;
      product_name: string;
      supplier_name: string;
      purchase_supplier: string | null;
      sale_price: number;
      sale_month: string;
      quantity_sold: number;
      revenue: number;
      has_journal: boolean;
      journal_cost: number;
      purchase_cost: number;
      purchase_qty: number;
      cost_source: 'purchase' | 'journal' | 'none';
      estimated_cost: number;
      resolved_cost: number;
      margin_pct: number;
    }

    const productRows: ProductRow[] = [];

    for (const [key, monthlySales] of salesByProductMonth) {
      const [code, saleMonth] = key.split('::');
      const product = productByCode.get(code);
      const purchase = purchaseByProduct.get(code)!;
      const supplierName = (product?.supplier_name as string) || '';
      const salePriceWithIva = (product?.sale_price as number) || 0;
      const salePrice = Math.round(salePriceWithIva / 1.19);
      const purchaseSupplier = supplierName ? (supplierMatchMap.get(supplierName) || null) : null;

      // Journal cost for THIS product in THIS month specifically
      const monthJournalCost = cogsByProductMonth.get(`${code}::${saleMonth}`) || 0;
      const hasJournal = monthJournalCost > 0;

      // Determine cost source per product+month
      let costSource: 'purchase' | 'journal' | 'none';
      let resolvedCost: number;

      if (purchase.qty > 0) {
        costSource = 'purchase';
        resolvedCost = purchase.costPerUnit;
      } else if (hasJournal) {
        costSource = 'journal';
        resolvedCost = monthlySales.qty > 0 ? Math.round(monthJournalCost / monthlySales.qty) : 0;
      } else {
        costSource = 'none';
        resolvedCost = 0;
      }

      const estimatedCost = monthlySales.qty > 0
        ? Math.round((monthlySales.revenue / monthlySales.qty) * 0.7) : 0;
      const effectiveCost = resolvedCost || estimatedCost;
      const marginPct = salePrice > 0 ? ((salePrice - effectiveCost) / salePrice) * 100 : 0;

      productRows.push({
        product_code: code,
        product_name: (product?.name as string) || code,
        supplier_name: supplierName,
        purchase_supplier: purchaseSupplier,
        sale_price: salePrice,
        sale_month: saleMonth,
        quantity_sold: monthlySales.qty,
        revenue: monthlySales.revenue,
        has_journal: hasJournal,
        journal_cost: monthJournalCost,
        purchase_cost: purchase.costPerUnit,
        purchase_qty: purchase.qty,
        cost_source: costSource,
        estimated_cost: estimatedCost,
        resolved_cost: resolvedCost,
        margin_pct: Math.round(marginPct * 10) / 10,
      });
    }

    // Sort: 'none' first, then by sale_month asc, then by revenue desc
    productRows.sort((a, b) => {
      if (a.cost_source === 'none' && b.cost_source !== 'none') return -1;
      if (a.cost_source !== 'none' && b.cost_source === 'none') return 1;
      if (a.sale_month !== b.sale_month) return a.sale_month.localeCompare(b.sale_month);
      return b.revenue - a.revenue;
    });

    // Summary (count unique products per category)
    const purchaseProductCodes = new Set<string>();
    const journalProductCodes = new Set<string>();
    const noCostProductCodes = new Set<string>();
    for (const p of productRows) {
      if (p.cost_source === 'purchase') purchaseProductCodes.add(p.product_code);
      else if (p.cost_source === 'journal') journalProductCodes.add(p.product_code);
      else noCostProductCodes.add(p.product_code);
    }

    return NextResponse.json({
      range: { start: startParam, end: endParam },
      summary: {
        total_products: salesTotalByProduct.size,
        total_rows: productRows.length,
        with_purchase_cost: purchaseProductCodes.size,
        with_journal_cost: journalProductCodes.size,
        with_no_cost: noCostProductCodes.size,
        total_revenue: productRows.reduce((s, p) => s + p.revenue, 0),
        revenue_with_cost: productRows.filter(p => p.cost_source !== 'none').reduce((s, p) => s + p.revenue, 0),
        revenue_no_cost: productRows.filter(p => p.cost_source === 'none').reduce((s, p) => s + p.revenue, 0),
      },
      products: productRows,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
