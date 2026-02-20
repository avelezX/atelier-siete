import { NextResponse } from 'next/server';

const SIIGO_API_URL = process.env.SIIGO_API_URL || 'https://api.siigo.com';
const SIIGO_USERNAME = process.env.SIIGO_USERNAME || '';
const SIIGO_ACCESS_KEY = process.env.SIIGO_ACCESS_KEY || '';

async function getToken(): Promise<string> {
  const res = await fetch(`${SIIGO_API_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: SIIGO_USERNAME, access_key: SIIGO_ACCESS_KEY }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function testEndpoint(token: string, path: string) {
  try {
    const res = await fetch(`${SIIGO_API_URL}${path}?page=1&page_size=1`, {
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        'Partner-Id': 'atelierSiete',
      },
    });
    const status = res.status;
    let body: string = '';
    try { body = await res.text(); } catch {}
    let parsed: unknown = null;
    try { parsed = JSON.parse(body); } catch {}
    return {
      path,
      status,
      available: res.ok,
      total: (parsed as any)?.pagination?.total_results ?? null,
      response_keys: parsed && typeof parsed === 'object' ? Object.keys(parsed as object) : null,
      body_preview: body.substring(0, 500),
    };
  } catch (e: unknown) {
    return { path, status: 'error', available: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET() {
  try {
    const token = await getToken();

    // Test sequentially to avoid timeouts
    const endpoints = [
      '/v1/purchase-invoices',
      '/v1/journals',
      '/v1/vouchers',
      '/v1/document-types',
    ];

    const results = [];
    for (const path of endpoints) {
      results.push(await testEndpoint(token, path));
    }

    return NextResponse.json({ results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
