import { NextResponse } from 'next/server';
import { fetchAllProducts } from '@/lib/siigo';

export async function GET() {
  try {
    const data = await fetchAllProducts();
    return NextResponse.json({ results: data, total: data.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Siigo /products]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
