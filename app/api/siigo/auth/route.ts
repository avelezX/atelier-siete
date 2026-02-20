import { NextResponse } from 'next/server';
import { testConnection } from '@/lib/siigo';

export async function GET() {
  try {
    const result = await testConnection();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
