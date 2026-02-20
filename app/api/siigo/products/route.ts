import { NextResponse } from 'next/server';
import { fetchAllProducts } from '@/lib/siigo';

export async function GET() {
  try {
    const data = await fetchAllProducts();
    return NextResponse.json({ results: data, total: data.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
