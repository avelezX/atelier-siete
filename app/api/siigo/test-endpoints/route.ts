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

    // Check total counts
    const headers = {
      'Authorization': token,
      'Content-Type': 'application/json',
      'Partner-Id': 'atelierSiete',
    };

    // Total journals
    const journalRes = await fetch(`${SIIGO_API_URL}/v1/journals?page=1&page_size=1`, { headers });
    const journalData = await journalRes.json();

    // Total vouchers
    const voucherRes = await fetch(`${SIIGO_API_URL}/v1/vouchers?page=1&page_size=1`, { headers });
    const voucherData = await voucherRes.json();

    // Total purchases
    const purchaseRes = await fetch(`${SIIGO_API_URL}/v1/purchases?page=1&page_size=1`, { headers });
    const purchaseData = await purchaseRes.json();

    // Fetch a journal with expense items (5xxx) to verify structure
    // Try fetching more journals to find one with expense items
    const journalsP2 = await fetch(`${SIIGO_API_URL}/v1/journals?page=1&page_size=5`, { headers });
    const journalsData2 = await journalsP2.json();
    const sampleJournals = (journalsData2.results || []).slice(0, 3);

    // Find all unique document.id values across sample journals
    const docIds = sampleJournals.map((j: any) => ({
      name: j.name,
      document_id: j.document?.id,
      items_count: j.items?.length || 0,
      sample_accounts: (j.items || []).slice(0, 3).map((i: any) => ({
        code: i.account?.code,
        movement: i.account?.movement,
        value: i.value,
      })),
    }));

    return NextResponse.json({
      totals: {
        journals: journalData.pagination?.total_results,
        vouchers: voucherData.pagination?.total_results,
        purchases: purchaseData.pagination?.total_results,
      },
      sample_journals: docIds,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
