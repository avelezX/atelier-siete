import { NextResponse } from 'next/server';
import { testConnection } from '@/lib/siigo';

export async function GET() {
  try {
    const result = await testConnection();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Siigo /auth]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
