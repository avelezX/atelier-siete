import { NextRequest, NextResponse } from 'next/server';
import { fetchInvoices } from '@/lib/siigo';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStart = searchParams.get('date_start') || undefined;
    const dateEnd = searchParams.get('date_end') || undefined;
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : undefined;
    const pageSize = searchParams.get('page_size') ? Number(searchParams.get('page_size')) : 25;

    const data = await fetchInvoices({ dateStart, dateEnd, page, pageSize });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Siigo /invoices]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
