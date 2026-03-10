import { NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

export const maxDuration = 60;

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

interface ProductBalance {
  code: string;
  name: string;
  supplier: string;
  group: string;
  is_consignment: boolean;
  active: boolean;
  qty: number;
  sale_price: number;
  sale_value: number;
  cost_unit: number | null;
  cost_value: number | null;
  avg_purchase_cost: number | null;
}

const MONTH_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

export async function GET() {
  try {
    // === 1. ALL products (including stock=0 for historical tracking) ===
    const allProducts = await fetchAllRows(
      'products',
      'code, name, supplier_name, account_group_name, is_consignment, active, available_quantity, cost, sale_price, sale_price_no_iva'
    );

    const productMap = new Map<string, Record<string, unknown>>();
    allProducts.forEach((p) => productMap.set((p.code as string) || '', p));

    const ownCodes = new Set(allProducts.filter(p => p.is_consignment === false).map(p => (p.code as string) || ''));
    const consCodes = new Set(allProducts.filter(p => p.is_consignment === true).map(p => (p.code as string) || ''));

    // === 2. Purchase items type Product (with dates via purchases) ===
    const purchaseItemsRaw = await fetchAllRows(
      'purchase_items',
      'purchase_id, product_code, price, quantity',
      (q) => q.eq('item_type', 'Product')
    );
    const purchases = await fetchAllRows('purchases', 'id, date');
    const purchaseDateMap = new Map<string, string>();
    purchases.forEach((p) => purchaseDateMap.set(p.id as string, (p.date as string) || ''));

    // === 3. Invoice items (sales, with dates via invoices) ===
    const invoiceItems = await fetchAllRows(
      'invoice_items',
      'invoice_id, product_code, quantity'
    );
    const invoices = await fetchAllRows('invoices', 'id, date', (q) => q.eq('annulled', false));
    const invoiceDateMap = new Map<string, string>();
    const validInvoiceIds = new Set<string>();
    invoices.forEach((inv) => {
      invoiceDateMap.set(inv.id as string, (inv.date as string) || '');
      validInvoiceIds.add(inv.id as string);
    });

    // === 4. Build avg purchase cost by product code ===
    const purchaseCostMap = new Map<string, { totalCost: number; totalQty: number }>();
    for (const pi of purchaseItemsRaw) {
      const code = (pi.product_code as string) || '';
      if (!code) continue;
      const price = Number(pi.price) || 0;
      const qty = Number(pi.quantity) || 1;
      if (!purchaseCostMap.has(code)) purchaseCostMap.set(code, { totalCost: 0, totalQty: 0 });
      const entry = purchaseCostMap.get(code)!;
      entry.totalCost += price * qty;
      entry.totalQty += qty;
    }

    // === 5. Build monthly deltas per product ===
    // delta[month][code] = { purchased, sold }
    type Delta = { purchased: number; sold: number };
    const monthlyDeltas = new Map<string, Map<string, Delta>>();

    function ensureDelta(month: string, code: string): Delta {
      if (!monthlyDeltas.has(month)) monthlyDeltas.set(month, new Map());
      const m = monthlyDeltas.get(month)!;
      if (!m.has(code)) m.set(code, { purchased: 0, sold: 0 });
      return m.get(code)!;
    }

    // Purchases by month
    for (const pi of purchaseItemsRaw) {
      const code = (pi.product_code as string) || '';
      if (!code) continue;
      const date = purchaseDateMap.get(pi.purchase_id as string);
      if (!date) continue;
      const month = date.substring(0, 7);
      const qty = Number(pi.quantity) || 1;
      ensureDelta(month, code).purchased += qty;
    }

    // Sales by month
    for (const ii of invoiceItems) {
      const invId = ii.invoice_id as string;
      if (!validInvoiceIds.has(invId)) continue;
      const code = (ii.product_code as string) || '';
      if (!code) continue;
      const date = invoiceDateMap.get(invId);
      if (!date) continue;
      const month = date.substring(0, 7);
      const qty = Number(ii.quantity) || 0;
      ensureDelta(month, code).sold += qty;
    }

    // === 6. Reconstruct stock at each month-end ===
    // current_stock is known. Work backwards from the most recent month.
    // stock_at_prev_month = stock_at_current_month - purchased_in_current + sold_in_current
    const allMonths = Array.from(monthlyDeltas.keys()).sort();
    if (allMonths.length === 0) {
      // No data — return empty
      return NextResponse.json({ summary: {}, own_by_supplier: [], consignment_by_supplier: [], monthly_balance: [] });
    }

    // Get all unique product codes that had any movement
    const allMovedCodes = new Set<string>();
    monthlyDeltas.forEach((m) => m.forEach((_, code) => allMovedCodes.add(code)));

    // Current stock per product
    const currentStock = new Map<string, number>();
    allProducts.forEach((p) => {
      currentStock.set((p.code as string) || '', Number(p.available_quantity) || 0);
    });

    // Also include products with stock but no movement
    allProducts.forEach((p) => {
      const code = (p.code as string) || '';
      if (Number(p.available_quantity) > 0) allMovedCodes.add(code);
    });

    // Build month-end stock going backwards
    // Start from the latest month, assume current stock is "after" latest month
    const monthEndStock = new Map<string, Map<string, number>>(); // month -> code -> stock
    const runningStock = new Map<string, number>();
    allMovedCodes.forEach((code) => runningStock.set(code, currentStock.get(code) || 0));

    // Walk backwards from latest month
    const sortedMonthsDesc = [...allMonths].sort().reverse();
    // Current month (today)
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // If the latest month with data is the current month, the running stock IS the end-of-month stock
    // For past months, we reconstruct
    for (const month of sortedMonthsDesc) {
      // Save current running stock as this month's end-of-month
      const snapshot = new Map<string, number>();
      runningStock.forEach((qty, code) => snapshot.set(code, qty));
      monthEndStock.set(month, snapshot);

      // Reverse the month's deltas to get the stock at the END of the previous month
      const deltas = monthlyDeltas.get(month);
      if (deltas) {
        deltas.forEach((delta, code) => {
          const current = runningStock.get(code) || 0;
          // Undo: stock_before = stock_after - purchased + sold
          runningStock.set(code, current - delta.purchased + delta.sold);
        });
      }
    }

    // === 7. Aggregate monthly balances ===
    interface MonthBalance {
      month: string;
      month_label: string;
      own_units: number;
      own_products: number;
      own_cost_value: number;
      own_sale_value: number;
      cons_units: number;
      cons_products: number;
      cons_sale_value: number;
    }

    const monthlyBalance: MonthBalance[] = allMonths.map((month) => {
      const stock = monthEndStock.get(month)!;
      let ownUnits = 0, ownProducts = 0, ownCostValue = 0, ownSaleValue = 0;
      let consUnits = 0, consProducts = 0, consSaleValue = 0;

      stock.forEach((qty, code) => {
        if (qty <= 0) return;
        const product = productMap.get(code);
        const salePrice = product
          ? (Number(product.sale_price_no_iva) || Number(product.sale_price) || 0)
          : 0;
        const purchaseData = purchaseCostMap.get(code);
        const avgCost = purchaseData && purchaseData.totalQty > 0
          ? purchaseData.totalCost / purchaseData.totalQty
          : 0;

        if (ownCodes.has(code)) {
          ownUnits += qty;
          ownProducts++;
          ownCostValue += avgCost * qty;
          ownSaleValue += salePrice * qty;
        } else if (consCodes.has(code)) {
          consUnits += qty;
          consProducts++;
          consSaleValue += salePrice * qty;
        }
      });

      const mi = parseInt(month.split('-')[1]) - 1;
      return {
        month,
        month_label: `${MONTH_NAMES[mi]} ${month.split('-')[0]}`,
        own_units: ownUnits,
        own_products: ownProducts,
        own_cost_value: Math.round(ownCostValue),
        own_sale_value: Math.round(ownSaleValue),
        cons_units: consUnits,
        cons_products: consProducts,
        cons_sale_value: Math.round(consSaleValue),
      };
    });

    // === 8. Current balances (products with stock > 0) ===
    const productsWithStock = allProducts.filter((p) => Number(p.available_quantity) > 0);

    const balances: ProductBalance[] = productsWithStock.map((p) => {
      const code = (p.code as string) || '';
      const qty = Number(p.available_quantity) || 0;
      const salePrice = Number(p.sale_price_no_iva) || Number(p.sale_price) || 0;
      const costUnit = Number(p.cost) || null;
      const purchaseData = purchaseCostMap.get(code);
      const avgPurchaseCost = purchaseData && purchaseData.totalQty > 0
        ? purchaseData.totalCost / purchaseData.totalQty
        : null;

      return {
        code,
        name: (p.name as string) || '',
        supplier: (p.supplier_name as string) || 'Sin proveedor',
        group: (p.account_group_name as string) || 'Sin grupo',
        is_consignment: p.is_consignment as boolean,
        active: p.active as boolean,
        qty,
        sale_price: salePrice,
        sale_value: qty * salePrice,
        cost_unit: costUnit,
        cost_value: costUnit ? costUnit * qty : null,
        avg_purchase_cost: avgPurchaseCost ? Math.round(avgPurchaseCost) : null,
      };
    });

    const own = balances.filter((b) => !b.is_consignment);
    const consignment = balances.filter((b) => b.is_consignment);

    function summarize(items: ProductBalance[]) {
      const withCost = items.filter((i) => i.avg_purchase_cost !== null);
      return {
        products: items.length,
        total_units: items.reduce((s, i) => s + i.qty, 0),
        total_sale_value: Math.round(items.reduce((s, i) => s + i.sale_value, 0)),
        total_cost_value: Math.round(withCost.reduce((s, i) => s + (i.avg_purchase_cost! * i.qty), 0)),
        products_with_cost: withCost.length,
        products_without_cost: items.length - withCost.length,
      };
    }

    function groupBySupplier(items: ProductBalance[]) {
      const map = new Map<string, ProductBalance[]>();
      for (const item of items) {
        if (!map.has(item.supplier)) map.set(item.supplier, []);
        map.get(item.supplier)!.push(item);
      }
      return Array.from(map.entries())
        .map(([supplier, prods]) => {
          const withCost = prods.filter((p) => p.avg_purchase_cost !== null);
          return {
            supplier,
            products: prods.length,
            total_units: prods.reduce((s, p) => s + p.qty, 0),
            total_sale_value: Math.round(prods.reduce((s, p) => s + p.sale_value, 0)),
            total_cost_value: Math.round(withCost.reduce((s, p) => s + (p.avg_purchase_cost! * p.qty), 0)),
            items: prods.sort((a, b) => b.sale_value - a.sale_value),
          };
        })
        .sort((a, b) => b.total_sale_value - a.total_sale_value);
    }

    return NextResponse.json({
      summary: {
        own: summarize(own),
        consignment: summarize(consignment),
        total: summarize(balances),
      },
      own_by_supplier: groupBySupplier(own),
      consignment_by_supplier: groupBySupplier(consignment),
      monthly_balance: monthlyBalance,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
