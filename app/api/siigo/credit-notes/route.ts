import { NextRequest, NextResponse } from 'next/server';
import { fetchAllCreditNotes } from '@/lib/siigo';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStart = searchParams.get('date_start') || undefined;
    const dateEnd = searchParams.get('date_end') || undefined;

    const data = await fetchAllCreditNotes({ dateStart, dateEnd });
    return NextResponse.json({ results: data, total: data.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Siigo /credit-notes]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
