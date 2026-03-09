import { NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

export const maxDuration = 30;

// Check if item_type and product_code columns are populated after sync
export async function GET() {
  try {
    // Count total purchase_items
    const { count: totalCount } = await atelierTableAdmin('purchase_items')
      .select('*', { count: 'exact', head: true });

    // Count items WITH item_type populated
    const { count: withType } = await atelierTableAdmin('purchase_items')
      .select('*', { count: 'exact', head: true })
      .not('item_type', 'is', null);

    // Count items WITHOUT item_type (null)
    const { count: withoutType } = await atelierTableAdmin('purchase_items')
      .select('*', { count: 'exact', head: true })
      .is('item_type', null);

    // Count by item_type
    const { data: sampleProduct } = await atelierTableAdmin('purchase_items')
      .select('item_type, product_code, account_code, description, line_total')
      .eq('item_type', 'Product')
      .limit(5);

    const { data: sampleAccount } = await atelierTableAdmin('purchase_items')
      .select('item_type, product_code, account_code, description, line_total')
      .eq('item_type', 'Account')
      .limit(5);

    const { data: sampleNull } = await atelierTableAdmin('purchase_items')
      .select('item_type, product_code, account_code, description, line_total')
      .is('item_type', null)
      .limit(5);

    // Count with product_code
    const { count: withProductCode } = await atelierTableAdmin('purchase_items')
      .select('*', { count: 'exact', head: true })
      .not('product_code', 'is', null);

    return NextResponse.json({
      total_items: totalCount,
      with_item_type: withType,
      without_item_type: withoutType,
      with_product_code: withProductCode,
      samples: {
        product_type: sampleProduct,
        account_type: sampleAccount,
        null_type: sampleNull,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
