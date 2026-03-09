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

export async function GET() {
  try {
    // Check what fields purchase_items actually have
    const sampleItems = await fetchAllRows(
      'purchase_items',
      '*',
      (q) => q.limit(5)
    );

    // Check siigo_metadata in purchases
    const samplePurchases = await fetchAllRows(
      'purchases',
      'id, supplier_name, siigo_metadata',
      (q) => q.limit(3)
    );

    // Check if purchase_items have description that matches product names
    const itemsWithDesc = await fetchAllRows(
      'purchase_items',
      'purchase_id, account_code, description, price, quantity',
      (q) => q.or('account_code.like.6135%,account_code.like.1435%').limit(20)
    );

    // Check products table — what does account_group_name look like?
    const productGroups = await fetchAllRows(
      'products',
      'account_group_name, is_consignment'
    );
    const groupCounts: Record<string, { total: number; consignment: number; own: number }> = {};
    productGroups.forEach((p) => {
      const group = (p.account_group_name as string) || '(null)';
      if (!groupCounts[group]) groupCounts[group] = { total: 0, consignment: 0, own: 0 };
      groupCounts[group].total++;
      if (p.is_consignment) groupCounts[group].consignment++;
      else groupCounts[group].own++;
    });

    // Check if purchase_items have any product-related fields we're missing
    const allColumns = sampleItems.length > 0 ? Object.keys(sampleItems[0]) : [];

    return NextResponse.json({
      purchase_items_columns: allColumns,
      sample_purchase_items: sampleItems,
      sample_purchases_metadata: samplePurchases.map((p) => ({
        id: p.id,
        supplier: p.supplier_name,
        metadata_keys: p.siigo_metadata ? Object.keys(p.siigo_metadata as Record<string, unknown>) : null,
        metadata_sample: p.siigo_metadata,
      })),
      modern_6135_1435_items: itemsWithDesc,
      product_groups: groupCounts,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
