import { NextResponse } from 'next/server';
import { fetchDocumentTypes } from '@/lib/siigo';

export async function GET() {
  try {
    const types = await fetchDocumentTypes('FV');
    return NextResponse.json(types);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
