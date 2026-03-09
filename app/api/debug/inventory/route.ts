import { NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

export const maxDuration = 30;

export async function GET() {
  try {
    const { data: products, error } = await atelierTableAdmin('products')
      .select('code, name, is_consignment, available_quantity, cost, sale_price, sale_price_no_iva, supplier_name, active, stock_control, account_group_name')
      .eq('active', true)
      .order('supplier_name', { ascending: true });

    if (error) throw new Error(error.message);
    if (!products) return NextResponse.json({ error: 'No data' }, { status: 500 });

    interface Product {
      code: string;
      name: string;
      is_consignment: boolean;
      available_quantity: number;
      cost: number | null;
      sale_price: number | null;
      sale_price_no_iva: number | null;
      supplier_name: string | null;
      active: boolean;
      stock_control: boolean;
      account_group_name: string | null;
    }

    const all = products as unknown as Product[];

    const consignment = all.filter(p => p.is_consignment);
    const own = all.filter(p => !p.is_consignment);

    const withStock = (list: Product[]) => list.filter(p => (p.available_quantity || 0) > 0);
    const totalUnits = (list: Product[]) => list.reduce((s, p) => s + (p.available_quantity || 0), 0);
    const totalCostValue = (list: Product[]) => list.reduce((s, p) => {
      const qty = p.available_quantity || 0;
      const cost = p.cost || 0;
      return s + qty * cost;
    }, 0);
    const totalSaleValue = (list: Product[]) => list.reduce((s, p) => {
      const qty = p.available_quantity || 0;
      const price = p.sale_price_no_iva || p.sale_price || 0;
      return s + qty * price;
    }, 0);
    const withoutCost = (list: Product[]) => list.filter(p => (p.available_quantity || 0) > 0 && !p.cost);

    // Group by supplier
    const bySupplier = (list: Product[]) => {
      const map = new Map<string, Product[]>();
      list.forEach(p => {
        const key = p.supplier_name || 'Sin proveedor';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(p);
      });
      return Array.from(map.entries())
        .map(([supplier, prods]) => ({
          supplier,
          total_products: prods.length,
          with_stock: withStock(prods).length,
          total_units: totalUnits(prods),
          cost_value: totalCostValue(prods),
          sale_value: totalSaleValue(prods),
          without_cost: withoutCost(prods).length,
          products: prods
            .filter(p => (p.available_quantity || 0) > 0)
            .sort((a, b) => (b.available_quantity || 0) - (a.available_quantity || 0))
            .map(p => ({
              code: p.code,
              name: p.name,
              qty: p.available_quantity || 0,
              cost: p.cost || null,
              sale_price: p.sale_price_no_iva || p.sale_price || null,
              cost_value: (p.available_quantity || 0) * (p.cost || 0),
              sale_value: (p.available_quantity || 0) * (p.sale_price_no_iva || p.sale_price || 0),
            })),
        }))
        .sort((a, b) => b.cost_value - a.cost_value);
    };

    return NextResponse.json({
      summary: {
        consignment: {
          total_products: consignment.length,
          with_stock: withStock(consignment).length,
          total_units: totalUnits(consignment),
          cost_value: totalCostValue(consignment),
          sale_value: totalSaleValue(consignment),
          without_cost_count: withoutCost(consignment).length,
        },
        own: {
          total_products: own.length,
          with_stock: withStock(own).length,
          total_units: totalUnits(own),
          cost_value: totalCostValue(own),
          sale_value: totalSaleValue(own),
          without_cost_count: withoutCost(own).length,
        },
      },
      consignment_by_supplier: bySupplier(consignment),
      own_by_supplier: bySupplier(own),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
