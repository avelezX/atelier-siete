import { NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

export const maxDuration = 30;

// Quick check: how much do own-inventory purchases total vs consignment
export async function GET() {
  try {
    // Get all own product codes
    const { data: ownProducts } = await atelierTableAdmin('products')
      .select('code')
      .eq('is_consignment', false);
    const ownCodes = new Set((ownProducts || []).map((p: { code: string }) => p.code));

    // Get all Product-type purchase items
    const { data: productItems } = await atelierTableAdmin('purchase_items')
      .select('product_code, line_total')
      .eq('item_type', 'Product');

    let ownProductTotal = 0;
    let consignmentProductTotal = 0;
    let ownProductCount = 0;
    let consignmentProductCount = 0;

    for (const item of (productItems || [])) {
      const code = (item as { product_code: string }).product_code;
      const total = Number((item as { line_total: number }).line_total) || 0;
      if (ownCodes.has(code)) {
        ownProductTotal += total;
        ownProductCount++;
      } else {
        consignmentProductTotal += total;
        consignmentProductCount++;
      }
    }

    // Get Account-type items with 6135/1435
    const { data: accountItems6135 } = await atelierTableAdmin('purchase_items')
      .select('account_code, line_total')
      .eq('item_type', 'Account')
      .like('account_code', '6135%');

    const { data: accountItems1435 } = await atelierTableAdmin('purchase_items')
      .select('account_code, line_total')
      .eq('item_type', 'Account')
      .like('account_code', '1435%');

    const account6135Total = (accountItems6135 || []).reduce(
      (sum: number, i: { line_total: number }) => sum + (Number(i.line_total) || 0), 0
    );
    const account1435Total = (accountItems1435 || []).reduce(
      (sum: number, i: { line_total: number }) => sum + (Number(i.line_total) || 0), 0
    );

    return NextResponse.json({
      own_product_codes_count: ownCodes.size,
      product_type_items: {
        own: { count: ownProductCount, total: Math.round(ownProductTotal) },
        consignment: { count: consignmentProductCount, total: Math.round(consignmentProductTotal) },
      },
      account_type_items: {
        '6135_total': Math.round(account6135Total),
        '6135_count': (accountItems6135 || []).length,
        '1435_total': Math.round(account1435Total),
        '1435_count': (accountItems1435 || []).length,
      },
      estimated_own_purchases: Math.round(ownProductTotal + account6135Total + account1435Total),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
