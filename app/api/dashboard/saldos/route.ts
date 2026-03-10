import { NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

export const maxDuration = 30;

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

export async function GET() {
  try {
    // All products with stock > 0
    const products = await fetchAllRows(
      'products',
      'code, name, supplier_name, account_group_name, is_consignment, active, available_quantity, cost, sale_price, sale_price_no_iva',
      (q) => q.gt('available_quantity', 0)
    );

    // Purchase items type Product for average cost calculation
    const purchaseItems = await fetchAllRows(
      'purchase_items',
      'product_code, price, quantity',
      (q) => q.eq('item_type', 'Product')
    );

    // Build avg purchase cost by product code
    const purchaseCostMap = new Map<string, { totalCost: number; totalQty: number }>();
    for (const pi of purchaseItems) {
      const code = (pi.product_code as string) || '';
      if (!code) continue;
      const price = Number(pi.price) || 0;
      const qty = Number(pi.quantity) || 1;
      if (!purchaseCostMap.has(code)) purchaseCostMap.set(code, { totalCost: 0, totalQty: 0 });
      const entry = purchaseCostMap.get(code)!;
      entry.totalCost += price * qty;
      entry.totalQty += qty;
    }

    const balances: ProductBalance[] = products.map((p) => {
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

    // Separate own vs consignment
    const own = balances.filter((b) => !b.is_consignment);
    const consignment = balances.filter((b) => b.is_consignment);

    // Summary helpers
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

    // Group by supplier
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
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
