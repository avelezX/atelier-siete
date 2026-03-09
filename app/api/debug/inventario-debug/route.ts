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
    // Check product classification
    const allProducts = await fetchAllRows('products', 'code, name, is_consignment, account_group_name, supplier_name, active');

    const ownProducts = allProducts.filter(p => p.is_consignment === false);
    const consignmentProducts = allProducts.filter(p => p.is_consignment === true);
    const nullGroup = allProducts.filter(p => !p.account_group_name);
    const ownNullGroup = ownProducts.filter(p => !p.account_group_name);

    // Group own products by account_group_name
    const groupCounts: Record<string, number> = {};
    ownProducts.forEach(p => {
      const group = (p.account_group_name as string) || '(null/empty)';
      groupCounts[group] = (groupCounts[group] || 0) + 1;
    });

    const allOwnCodes = new Set(ownProducts.map(p => (p.code as string) || ''));

    // Get ALL Product-type purchase items (paginated)
    const productPurchaseItems = await fetchAllRows(
      'purchase_items',
      'product_code, price, quantity, line_total',
      (q) => q.eq('item_type', 'Product')
    );

    // Match against own codes
    let ownTotal = 0;
    let ownCount = 0;
    let consTotal = 0;
    let consCount = 0;
    const ownCodeTotals: Record<string, number> = {};

    for (const pi of productPurchaseItems) {
      const code = (pi.product_code as string) || '';
      const value = (Number(pi.price) || 0) * (Number(pi.quantity) || 1);
      if (allOwnCodes.has(code)) {
        ownTotal += value;
        ownCount++;
        ownCodeTotals[code] = (ownCodeTotals[code] || 0) + value;
      } else {
        consTotal += value;
        consCount++;
      }
    }

    // Top 20 own codes by purchase value
    const topOwnCodes = Object.entries(ownCodeTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([code, total]) => {
        const prod = allProducts.find(p => p.code === code);
        return {
          code,
          name: prod?.name || '?',
          supplier: prod?.supplier_name || '?',
          group: prod?.account_group_name || '(null)',
          is_consignment: prod?.is_consignment,
          active: prod?.active,
          purchase_total: Math.round(total),
        };
      });

    return NextResponse.json({
      products: {
        total: allProducts.length,
        own: ownProducts.length,
        consignment: consignmentProducts.length,
        null_group: nullGroup.length,
        own_with_null_group: ownNullGroup.length,
        own_groups: groupCounts,
      },
      purchase_items_product_type: {
        total: productPurchaseItems.length,
        own_match: ownCount,
        consignment_match: consCount,
        own_total: Math.round(ownTotal),
        consignment_total: Math.round(consTotal),
      },
      top_20_own_by_purchase_value: topOwnCodes,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
