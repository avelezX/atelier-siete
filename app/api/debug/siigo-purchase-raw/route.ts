import { NextResponse } from 'next/server';
import { fetchPurchases } from '@/lib/siigo';

export const maxDuration = 30;

// Fetch raw Siigo purchases to inspect item structure — especially `type` field
export async function GET() {
  try {
    // Get the last page (most recent purchases)
    const firstPage = await fetchPurchases(1, 5);
    const totalResults = firstPage.pagination.total_results;
    const lastPage = Math.ceil(totalResults / 5);

    // Get most recent 5 purchases
    const recentPage = await fetchPurchases(lastPage, 5);

    const purchases = recentPage.results.map((p) => ({
      id: p.id,
      name: p.name,
      date: p.date,
      supplier: p.supplier,
      total: p.total,
      items: p.items.map((item) => ({
        id: item.id,
        type: item.type,        // KEY: 'Account' or 'Product'?
        code: item.code,        // PUC code or product code?
        description: item.description,
        quantity: item.quantity,
        price: item.price,
        discount: item.discount,
        total: item.total,
        taxes: item.taxes,
      })),
    }));

    // Also get some older purchases to compare
    const olderPage = await fetchPurchases(Math.max(1, Math.floor(lastPage / 2)), 5);
    const olderPurchases = olderPage.results.map((p) => ({
      id: p.id,
      name: p.name,
      date: p.date,
      supplier: p.supplier,
      total: p.total,
      items: p.items.map((item) => ({
        id: item.id,
        type: item.type,
        code: item.code,
        description: item.description,
        quantity: item.quantity,
        price: item.price,
        discount: item.discount,
        total: item.total,
        taxes: item.taxes,
      })),
    }));

    return NextResponse.json({
      total_purchases: totalResults,
      recent_purchases: purchases,
      older_purchases: olderPurchases,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
