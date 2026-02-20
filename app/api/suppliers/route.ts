import { NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

// GET /api/suppliers - List all suppliers with product counts and sales stats
export async function GET() {
  try {
    // Get all suppliers
    const { data: suppliers, error } = await atelierTableAdmin('suppliers')
      .select('*')
      .order('name');

    if (error) throw new Error(error.message);

    // Get product counts per supplier
    const { data: productCounts, error: pcError } = await atelierTableAdmin('products')
      .select('supplier_id, supplier_name')
      .not('supplier_id', 'is', null);

    if (pcError) throw new Error(pcError.message);

    // Get sales data from invoice_items joined with products
    const { data: salesData, error: salesError } = await atelierTableAdmin('invoice_items')
      .select('product_id, line_total, quantity');

    if (salesError) throw new Error(salesError.message);

    // Build product_id → supplier_id map
    const { data: products, error: prodError } = await atelierTableAdmin('products')
      .select('id, supplier_id, sale_price');

    if (prodError) throw new Error(prodError.message);

    const productSupplierMap = new Map<string, string>();
    (products || []).forEach((p: { id: string; supplier_id: string | null }) => {
      if (p.supplier_id) productSupplierMap.set(p.id, p.supplier_id);
    });

    // Aggregate product counts by supplier
    const supplierProductCount = new Map<string, number>();
    (productCounts || []).forEach((p: { supplier_id: string }) => {
      const count = supplierProductCount.get(p.supplier_id) || 0;
      supplierProductCount.set(p.supplier_id, count + 1);
    });

    // Aggregate sales by supplier
    const supplierSales = new Map<string, { total: number; items_sold: number }>();
    (salesData || []).forEach((item: { product_id: string | null; line_total: number; quantity: number }) => {
      if (!item.product_id) return;
      const supplierId = productSupplierMap.get(item.product_id);
      if (!supplierId) return;
      const current = supplierSales.get(supplierId) || { total: 0, items_sold: 0 };
      current.total += item.line_total || 0;
      current.items_sold += item.quantity || 0;
      supplierSales.set(supplierId, current);
    });

    // Enrich suppliers with stats
    const enriched = (suppliers || []).map((s: Record<string, unknown>) => ({
      ...s,
      product_count: supplierProductCount.get(s.id as string) || 0,
      total_sales: supplierSales.get(s.id as string)?.total || 0,
      items_sold: supplierSales.get(s.id as string)?.items_sold || 0,
    }));

    return NextResponse.json({ suppliers: enriched });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/suppliers - Update a supplier
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Se requiere id' }, { status: 400 });
    }

    const { data, error } = await atelierTableAdmin('suppliers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ supplier: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
