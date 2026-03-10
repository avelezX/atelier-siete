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

    // Fetch a single voucher to see item structure
    const voucherRes = await fetch(`${SIIGO_API_URL}/v1/vouchers?page=1&page_size=2`, {
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        'Partner-Id': 'atelierSiete',
      },
    });
    const voucherData = await voucherRes.json();
    const sampleVouchers = (voucherData.results || []).slice(0, 2);

    // Also fetch a journal for comparison
    const journalRes = await fetch(`${SIIGO_API_URL}/v1/journals?page=1&page_size=1`, {
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        'Partner-Id': 'atelierSiete',
      },
    });
    const journalData = await journalRes.json();
    const sampleJournal = (journalData.results || [])[0];

    return NextResponse.json({
      voucher_total: voucherData.pagination?.total_results,
      sample_vouchers: sampleVouchers,
      sample_journal: sampleJournal,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
