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
    const allOwnProducts = await fetchAllRows('products', 'code', (q) => q.eq('is_consignment', false));
    const allOwnProductCodes = new Set(allOwnProducts.map((p) => (p.code as string) || ''));

    const allPurchaseItems = await fetchAllRows(
      'purchase_items',
      'purchase_id, account_code, item_type, product_code, price, quantity, line_total'
    );

    function isOwnInventoryPurchaseItem(pi: Record<string, unknown>): boolean {
      const itemType = (pi.item_type as string) || null;
      const productCode = (pi.product_code as string) || '';
      const accountCode = (pi.account_code as string) || '';

      if (itemType === 'Product') {
        return productCode ? allOwnProductCodes.has(productCode) : false;
      }
      if (itemType === 'Account') {
        return accountCode.startsWith('6135') || accountCode.startsWith('1435');
      }
      if (itemType === 'FixedAsset') {
        return false;
      }
      // Legacy
      if (accountCode && !/^[0-9]/.test(accountCode)) {
        return allOwnProductCodes.has(accountCode);
      }
      if (accountCode.startsWith('6135') || accountCode.startsWith('1435')) {
        return true;
      }
      return false;
    }

    const filtered = allPurchaseItems.filter(isOwnInventoryPurchaseItem);

    // Calculate total with price*qty (as inventario route does)
    const totalPriceQty = filtered.reduce((s, pi) => {
      return s + (Number(pi.price) || 0) * (Number(pi.quantity) || 1);
    }, 0);

    // Calculate total with line_total
    const totalLineTotal = filtered.reduce((s, pi) => {
      return s + (Number(pi.line_total) || 0);
    }, 0);

    // All items total (unfiltered)
    const allTotalPriceQty = allPurchaseItems.reduce((s, pi) => {
      return s + (Number(pi.price) || 0) * (Number(pi.quantity) || 1);
    }, 0);

    // Sample some filtered items
    const sampleFiltered = filtered.slice(0, 10).map(pi => ({
      item_type: pi.item_type,
      account_code: pi.account_code,
      product_code: pi.product_code,
      price: pi.price,
      quantity: pi.quantity,
      line_total: pi.line_total,
      price_x_qty: (Number(pi.price) || 0) * (Number(pi.quantity) || 1),
    }));

    return NextResponse.json({
      total_items: allPurchaseItems.length,
      filtered_items: filtered.length,
      all_total_price_qty: Math.round(allTotalPriceQty),
      filtered_total_price_qty: Math.round(totalPriceQty),
      filtered_total_line_total: Math.round(totalLineTotal),
      by_type_all: {
        Product: allPurchaseItems.filter(pi => pi.item_type === 'Product').length,
        Account: allPurchaseItems.filter(pi => pi.item_type === 'Account').length,
        FixedAsset: allPurchaseItems.filter(pi => pi.item_type === 'FixedAsset').length,
        null: allPurchaseItems.filter(pi => !pi.item_type).length,
      },
      by_type_filtered: {
        Product: filtered.filter(pi => pi.item_type === 'Product').length,
        Account: filtered.filter(pi => pi.item_type === 'Account').length,
        FixedAsset: filtered.filter(pi => pi.item_type === 'FixedAsset').length,
        null: filtered.filter(pi => !pi.item_type).length,
      },
      sample_filtered: sampleFiltered,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
