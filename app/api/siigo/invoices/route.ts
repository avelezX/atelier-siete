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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
