import { NextRequest, NextResponse } from 'next/server';
import { fetchDocumentTypes } from '@/lib/siigo';

export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get('type') || undefined;
    const data = await fetchDocumentTypes(type);
    return NextResponse.json({ results: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Siigo /document-types]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
