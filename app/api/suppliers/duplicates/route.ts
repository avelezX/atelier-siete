import { NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

// GET /api/suppliers/duplicates - Detect potential duplicate suppliers
export async function GET() {
  try {
    const { data: suppliers, error } = await atelierTableAdmin('suppliers')
      .select('id, name')
      .order('name');

    if (error) throw new Error(error.message);
    if (!suppliers?.length) {
      return NextResponse.json({ groups: [] });
    }

    // Get product counts per supplier
    const { data: products } = await atelierTableAdmin('products')
      .select('supplier_id')
      .not('supplier_id', 'is', null);

    const productCount = new Map<string, number>();
    (products || []).forEach((p: { supplier_id: string }) => {
      productCount.set(p.supplier_id, (productCount.get(p.supplier_id) || 0) + 1);
    });

    // Group suppliers by normalized name (lowercase, remove common suffixes)
    const normalize = (name: string): string => {
      return name
        .toLowerCase()
        .trim()
        .replace(/\s+(consignacion|cons|consig|consignación)$/i, '')
        .replace(/\s+/g, ' ');
    };

    const groups = new Map<string, Array<{ id: string; name: string; product_count: number }>>();

    for (const s of suppliers as Array<{ id: string; name: string }>) {
      const key = normalize(s.name);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({
        id: s.id,
        name: s.name,
        product_count: productCount.get(s.id) || 0,
      });
    }

    // Only return groups with more than 1 supplier (actual duplicates)
    const duplicateGroups = Array.from(groups.entries())
      .filter(([, members]) => members.length > 1)
      .map(([normalizedName, members]) => ({
        normalized_name: normalizedName,
        members: members.sort((a, b) => b.product_count - a.product_count),
        total_products: members.reduce((sum, m) => sum + m.product_count, 0),
      }))
      .sort((a, b) => b.total_products - a.total_products);

    return NextResponse.json({
      groups: duplicateGroups,
      total_duplicate_groups: duplicateGroups.length,
      total_suppliers_involved: duplicateGroups.reduce((sum, g) => sum + g.members.length, 0),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
