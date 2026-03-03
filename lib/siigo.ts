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
  SiigoJournal,
  SiigoVoucher,
  SiigoTaxCatalog,
  SiigoPaymentType,
  SiigoCreateInvoiceRequest,
  SiigoCreateInvoiceResponse,
  SiigoDocumentType,
  SiigoCreateJournalRequest,
  SiigoCreateJournalResponse,
  SiigoPurchase,
} from '@/types/siigo';

const SIIGO_API_URL = process.env.SIIGO_API_URL || 'https://api.siigo.com';
const SIIGO_USERNAME = process.env.SIIGO_USERNAME || '';
const SIIGO_ACCESS_KEY = process.env.SIIGO_ACCESS_KEY || '';
const SIIGO_PARTNER_ID = process.env.SIIGO_PARTNER_ID || 'atelierSiete';

// Token cache (module-level singleton)
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

// Data cache for stable reference data (products, customers, catalogs)
interface DataCacheEntry<T> {
  data: T[];
  expiresAt: number;
}
const _dataCache = new Map<string, DataCacheEntry<unknown>>();
const CACHE_1H  = 60 * 60 * 1000;
const CACHE_24H = 24 * 60 * 60 * 1000;

async function getCachedOrFetch<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T[]>
): Promise<T[]> {
  const cached = _dataCache.get(key) as DataCacheEntry<T> | undefined;
  if (cached && Date.now() < cached.expiresAt) {
    console.log(`[Siigo] cache HIT: ${key}`);
    return cached.data;
  }
  console.log(`[Siigo] cache MISS: ${key} — fetching from API...`);
  const data = await fn();
  _dataCache.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
}

/**
 * Authenticate with Siigo API. Caches token for ~23 hours (valid 24h).
 */
async function getToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken; // cache HIT — no log needed (called on every request)
  }
  console.log('[Siigo] Fetching new token...');

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
  console.log('[Siigo] Token cacheado — expira en 23h');
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
    console.log('[Siigo] 401 en GET — limpiando token y reintentando...');
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
    console.log('[Siigo] 401 en POST — limpiando token y reintentando...');
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

/** Fetch ALL customers (cached 1h) */
export async function fetchAllCustomers(): Promise<SiigoCustomer[]> {
  return getCachedOrFetch('customers', CACHE_1H, () =>
    fetchAllPages<SiigoCustomer>('/v1/customers')
  );
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

/** Fetch ALL products (cached 1h) */
export async function fetchAllProducts(): Promise<SiigoProduct[]> {
  return getCachedOrFetch('products', CACHE_1H, () =>
    fetchAllPages<SiigoProduct>('/v1/products')
  );
}

/** Fetch taxes catalog (cached 24h) */
export async function fetchTaxes(): Promise<SiigoTaxCatalog[]> {
  return getCachedOrFetch('taxes', CACHE_24H, () =>
    siigoGet<SiigoTaxCatalog[]>('/v1/taxes').then(d => Array.isArray(d) ? d : [d])
  );
}

/** Fetch payment types (cached 24h) */
export async function fetchPaymentTypes(): Promise<SiigoPaymentType[]> {
  return getCachedOrFetch('payment-types', CACHE_24H, () =>
    siigoGet<SiigoPaymentType[]>('/v1/payment-types', { document_type: 'FV' }).then(d => Array.isArray(d) ? d : [d])
  );
}

/** Create a new invoice in Siigo */
export async function createInvoice(data: SiigoCreateInvoiceRequest): Promise<SiigoCreateInvoiceResponse> {
  return siigoPost<SiigoCreateInvoiceResponse>('/v1/invoices', data);
}

/** Fetch document types catalog (cached 24h, filtered by type: CC, FV, etc.) */
export async function fetchDocumentTypes(type?: string): Promise<SiigoDocumentType[]> {
  const key = `document-types:${type ?? ''}`;
  const params: Record<string, string> = {};
  if (type) params.type = type;
  return getCachedOrFetch(key, CACHE_24H, () =>
    siigoGet<SiigoDocumentType[]>('/v1/document-types', params).then(d => Array.isArray(d) ? d : [d])
  );
}

/** Create a journal entry (comprobante contable) in Siigo */
export async function createJournal(data: SiigoCreateJournalRequest): Promise<SiigoCreateJournalResponse> {
  return siigoPost<SiigoCreateJournalResponse>('/v1/journals', data);
}

/** Fetch a single journal entry by its Siigo ID */
export async function fetchJournal(id: string): Promise<SiigoCreateJournalResponse> {
  return siigoGet<SiigoCreateJournalResponse>(`/v1/journals/${id}`);
}

/** Fetch ALL journals (comprobantes contables) */
export async function fetchAllJournals(): Promise<SiigoJournal[]> {
  return fetchAllPages<SiigoJournal>('/v1/journals');
}

/** Fetch ALL vouchers (recibos de caja) */
export async function fetchAllVouchers(): Promise<SiigoVoucher[]> {
  return fetchAllPages<SiigoVoucher>('/v1/vouchers');
}

/** Fetch a single page of purchases (facturas de compra) */
export async function fetchPurchases(page = 1, pageSize = 25): Promise<SiigoPaginatedResponse<SiigoPurchase>> {
  return siigoGet<SiigoPaginatedResponse<SiigoPurchase>>('/v1/purchases', {
    page: String(page),
    page_size: String(pageSize),
  });
}

/** Fetch ALL purchases (facturas de compra) */
export async function fetchAllPurchases(): Promise<SiigoPurchase[]> {
  return fetchAllPages<SiigoPurchase>('/v1/purchases');
}

/** Invalidate cached token */
export function invalidateToken() {
  cachedToken = null;
  tokenExpiresAt = 0;
}

/** Invalidate data cache. Pass a key to invalidate one entry, or omit to clear all. */
export function invalidateDataCache(key?: string) {
  if (key) _dataCache.delete(key);
  else _dataCache.clear();
}
