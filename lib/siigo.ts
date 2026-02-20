// =====================================================
// Cliente API de Siigo — Atelier Siete
// Maneja autenticación, token caching, y paginación
// Solo para uso server-side (API routes)
// =====================================================

import type {
  SiigoAuthResponse,
  SiigoPaginatedResponse,
  SiigoInvoice,
  SiigoCustomer,
  SiigoCreditNote,
  SiigoProduct,
  SiigoTaxCatalog,
  SiigoPaymentType,
  SiigoCreateInvoiceRequest,
  SiigoCreateInvoiceResponse,
} from '@/types/siigo';

const SIIGO_API_URL = process.env.SIIGO_API_URL || 'https://api.siigo.com';
const SIIGO_USERNAME = process.env.SIIGO_USERNAME || '';
const SIIGO_ACCESS_KEY = process.env.SIIGO_ACCESS_KEY || '';
const SIIGO_PARTNER_ID = process.env.SIIGO_PARTNER_ID || 'atelierSiete';

// Token cache (module-level singleton)
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Authenticate with Siigo API. Caches token for ~23 hours (valid 24h).
 */
async function getToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  if (!SIIGO_USERNAME || !SIIGO_ACCESS_KEY) {
    throw new Error('SIIGO_USERNAME y SIIGO_ACCESS_KEY deben estar configurados en .env.local');
  }

  const res = await fetch(`${SIIGO_API_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: SIIGO_USERNAME,
      access_key: SIIGO_ACCESS_KEY,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    cachedToken = null;
    tokenExpiresAt = 0;
    throw new Error(`Siigo auth failed (${res.status}): ${text}`);
  }

  const data: SiigoAuthResponse = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + 23 * 60 * 60 * 1000;
  return cachedToken;
}

/**
 * Make authenticated GET request to Siigo API.
 */
async function siigoGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const token = await getToken();
  const url = new URL(`${SIIGO_API_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, v);
    });
  }

  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': token,
      'Content-Type': 'application/json',
      'Partner-Id': SIIGO_PARTNER_ID,
    },
  });

  if (res.status === 401) {
    cachedToken = null;
    tokenExpiresAt = 0;
    const newToken = await getToken();
    const retryRes = await fetch(url.toString(), {
      headers: {
        'Authorization': newToken,
        'Content-Type': 'application/json',
        'Partner-Id': SIIGO_PARTNER_ID,
      },
    });
    if (!retryRes.ok) {
      throw new Error(`Siigo API error (${retryRes.status}): ${await retryRes.text()}`);
    }
    return retryRes.json();
  }

  if (!res.ok) {
    throw new Error(`Siigo API error (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/**
 * Make authenticated POST request to Siigo API.
 */
async function siigoPost<T>(path: string, body: unknown): Promise<T> {
  const token = await getToken();
  const url = `${SIIGO_API_URL}${path}`;

  const doRequest = (authToken: string) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authToken,
        'Content-Type': 'application/json',
        'Partner-Id': SIIGO_PARTNER_ID,
      },
      body: JSON.stringify(body),
    });

  let res = await doRequest(token);

  if (res.status === 401) {
    cachedToken = null;
    tokenExpiresAt = 0;
    const newToken = await getToken();
    res = await doRequest(newToken);
  }

  if (!res.ok) {
    let errMsg: string;
    try {
      const errJson = await res.json();
      const msgs = errJson?.Errors?.map((e: any) => e.Message).join('; ');
      errMsg = msgs || JSON.stringify(errJson);
    } catch {
      errMsg = await res.text();
    }
    throw new Error(`Siigo API error (${res.status}): ${errMsg}`);
  }

  return res.json();
}

/**
 * Fetch all pages of a paginated Siigo endpoint.
 */
async function fetchAllPages<T>(
  path: string,
  params?: Record<string, string>,
  pageSize: number = 100
): Promise<T[]> {
  const allResults: T[] = [];
  let page = 1;
  let totalResults = Infinity;

  while (allResults.length < totalResults) {
    const data = await siigoGet<SiigoPaginatedResponse<T>>(path, {
      ...params,
      page: String(page),
      page_size: String(pageSize),
    });

    totalResults = data.pagination.total_results;
    allResults.push(...data.results);
    page++;

    if (data.results.length === 0) break;
  }

  return allResults;
}

// =====================================================
// Public API functions
// =====================================================

/** Test connection to Siigo API */
export async function testConnection() {
  try {
    const token = await getToken();
    const sample = await siigoGet<SiigoPaginatedResponse<SiigoInvoice>>('/v1/invoices', {
      page: '1',
      page_size: '1',
    });
    return {
      success: true,
      message: `Conexion exitosa. ${sample.pagination.total_results} facturas disponibles.`,
      details: {
        totalInvoices: sample.pagination.total_results,
        tokenPreview: token.substring(0, 30) + '...',
      },
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

/** Fetch a single page of invoices */
export async function fetchInvoices(opts?: {
  dateStart?: string;
  dateEnd?: string;
  page?: number;
  pageSize?: number;
}): Promise<SiigoPaginatedResponse<SiigoInvoice>> {
  const params: Record<string, string> = {};
  if (opts?.dateStart) params.date_start = opts.dateStart;
  if (opts?.dateEnd) params.date_end = opts.dateEnd;
  if (opts?.page) params.page = String(opts.page);
  if (opts?.pageSize) params.page_size = String(opts.pageSize);
  return siigoGet<SiigoPaginatedResponse<SiigoInvoice>>('/v1/invoices', params);
}

/** Fetch ALL invoices */
export async function fetchAllInvoices(opts?: {
  dateStart?: string;
  dateEnd?: string;
}): Promise<SiigoInvoice[]> {
  const params: Record<string, string> = {};
  if (opts?.dateStart) params.date_start = opts.dateStart;
  if (opts?.dateEnd) params.date_end = opts.dateEnd;
  return fetchAllPages<SiigoInvoice>('/v1/invoices', params);
}

/** Fetch ALL customers */
export async function fetchAllCustomers(): Promise<SiigoCustomer[]> {
  return fetchAllPages<SiigoCustomer>('/v1/customers');
}

/** Fetch ALL credit notes */
export async function fetchAllCreditNotes(opts?: {
  dateStart?: string;
  dateEnd?: string;
}): Promise<SiigoCreditNote[]> {
  const params: Record<string, string> = {};
  if (opts?.dateStart) params.date_start = opts.dateStart;
  if (opts?.dateEnd) params.date_end = opts.dateEnd;
  return fetchAllPages<SiigoCreditNote>('/v1/credit-notes', params);
}

/** Fetch ALL products */
export async function fetchAllProducts(): Promise<SiigoProduct[]> {
  return fetchAllPages<SiigoProduct>('/v1/products');
}

/** Fetch taxes catalog */
export async function fetchTaxes(): Promise<SiigoTaxCatalog[]> {
  return siigoGet<SiigoTaxCatalog[]>('/v1/taxes');
}

/** Fetch payment types */
export async function fetchPaymentTypes(): Promise<SiigoPaymentType[]> {
  return siigoGet<SiigoPaymentType[]>('/v1/payment-types', { document_type: 'FV' });
}

/** Create a new invoice in Siigo */
export async function createInvoice(data: SiigoCreateInvoiceRequest): Promise<SiigoCreateInvoiceResponse> {
  return siigoPost<SiigoCreateInvoiceResponse>('/v1/invoices', data);
}

/** Invalidate cached token */
export function invalidateToken() {
  cachedToken = null;
  tokenExpiresAt = 0;
}
