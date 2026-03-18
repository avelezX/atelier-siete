import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set('p-auth', '', { path: '/', maxAge: 0 });
  return response;
}
