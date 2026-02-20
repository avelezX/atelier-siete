import { NextRequest, NextResponse } from 'next/server';
import { fetchPurchases } from '@/lib/siigo';

export async function GET(request: NextRequest) {
  try {
    const page = request.nextUrl.searchParams.get('page') || '1';
    const pageSize = request.nextUrl.searchParams.get('page_size') || '5';
    const data = await fetchPurchases(Number(page), Number(pageSize));
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
