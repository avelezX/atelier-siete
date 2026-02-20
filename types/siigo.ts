// =====================================================
// Tipos TypeScript para la API de Siigo
// Documentación: https://developers.siigo.com/
// =====================================================

// --- Authentication ---

export interface SiigoAuthResponse {
  access_token: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

// --- Pagination ---

export interface SiigoPagination {
  page: number;
  page_size: number;
  total_results: number;
}

export interface SiigoPaginatedResponse<T> {
  pagination: SiigoPagination;
  results: T[];
}

// --- Invoices (Facturas de Venta) ---

export interface SiigoInvoiceItem {
  id?: string;
  code: string;
  description: string;
  quantity: number;
  price: number;
  discount?: number;
  taxes?: SiigoTax[];
  total?: number;
}

export interface SiigoTax {
  id: number;
  name: string;
  type?: string;
  percentage: number;
  value: number;
  base_value?: number;
}

export interface SiigoRetention {
  id: number;
  name: string;
  type?: string;
  percentage: number;
  value: number;
}

export interface SiigoPayment {
  id: number;
  name?: string;
  value: number;
  due_date?: string;
}

export interface SiigoCustomerRef {
  id: string;
  identification: string;
  branch_office?: number;
  name?: string[];
}

export interface SiigoStamp {
  status?: string;
  cufe?: string;
  cude?: string;
  observations?: string;
  errors?: string;
}

export interface SiigoInvoice {
  id: string;
  document: { id: number };
  prefix: string;
  number: number;
  name: string;
  date: string;
  customer: SiigoCustomerRef;
  cost_center?: number;
  currency: { code: string; exchange_rate: number };
  seller?: number;
  retentions?: SiigoRetention[];
  advance_payment?: number;
  items?: SiigoInvoiceItem[];
  payments?: SiigoPayment[];
  total: number;
  balance: number;
  observations?: string;
  annulled?: boolean;
  stamp?: SiigoStamp;
  mail?: { status?: string; observations?: string };
  metadata?: { created?: string; last_updated?: string };
}

// --- Credit Notes (Notas Crédito) ---

export interface SiigoCreditNote {
  id: string;
  document: { id: number };
  prefix: string;
  number: number;
  name: string;
  date: string;
  customer: SiigoCustomerRef;
  invoice?: { id: string; name: string };
  items?: SiigoInvoiceItem[];
  total: number;
  observations?: string;
  stamp?: SiigoStamp;
  metadata?: { created?: string; last_updated?: string };
}

// --- Customers (Terceros) ---

export interface SiigoCustomer {
  id: string;
  type: string;
  person_type: string;
  id_type: { code: string; name: string };
  identification: string;
  check_digit?: string;
  name: string[];
  commercial_name?: string;
  branch_office?: number;
  active: boolean;
  vat_responsible?: boolean;
  fiscal_responsibilities?: Array<{ code: string; name: string }>;
  address?: {
    address: string;
    city?: { country_code: string; state_code: string; city_code: string };
  };
  phones?: Array<{ indicative?: string; number: string; extension?: string }>;
  contacts?: Array<{
    first_name: string;
    last_name: string;
    email: string;
    phone?: { number: string };
  }>;
  metadata?: { created?: string; last_updated?: string };
}

// --- Products ---

export interface SiigoAccountGroup {
  id: number;
  name: string;
}

export interface SiigoProductWarehouse {
  id: number;
  name: string;
  quantity: number;
}

export interface SiigoProductPrice {
  currency_code: string;
  price_list: Array<{ position: number; name?: string; value: number }>;
}

export interface SiigoProduct {
  id: string;
  code: string;
  name: string;
  account_group?: SiigoAccountGroup;
  type?: string;
  stock_control?: boolean;
  active: boolean;
  tax_classification?: 'Taxed' | 'Exempt' | 'Excluded';
  tax_included?: boolean;
  taxes?: Array<{ id: number; name: string; type?: string; percentage: number }>;
  prices?: SiigoProductPrice[];
  unit?: { code: string; name: string };
  unit_label?: string;
  reference?: string;
  description?: string;
  available_quantity?: number;
  warehouses?: SiigoProductWarehouse[];
  additional_fields?: Record<string, string>;
  metadata?: { created?: string; last_updated?: string };
}

// --- Tax Catalog ---

export interface SiigoTaxCatalog {
  id: number;
  name: string;
  type?: string;
  percentage: number;
}

// --- Payment Types ---

export interface SiigoPaymentType {
  id: number;
  name: string;
  type?: string;
  due_date?: number;
}

// --- Journals (Comprobantes Contables) ---

export interface SiigoJournalItemAccount {
  code: string;
  movement: 'Debit' | 'Credit';
}

export interface SiigoJournalItemCustomer {
  id: string;
  identification: string;
  branch_office?: number;
}

export interface SiigoJournalItemProduct {
  id: string;
  code: string;
  name: string;
  quantity: number;
}

export interface SiigoJournalItem {
  account: SiigoJournalItemAccount;
  customer?: SiigoJournalItemCustomer;
  product?: SiigoJournalItemProduct;
  description: string;
  value: number;
}

export interface SiigoJournal {
  id: string;
  document: { id: number };
  number: number;
  name: string;
  date: string;
  items: SiigoJournalItem[];
  observations?: string;
  metadata?: { created?: string };
}

// --- Vouchers (Recibos de Caja) ---

export interface SiigoVoucher {
  id: string;
  document: { id: number };
  number: number;
  name: string;
  date: string;
  type: string;
  items: SiigoJournalItem[];
  observations?: string;
  metadata?: { created?: string };
}

// --- Create Invoice Request / Response ---

export interface SiigoCreateInvoiceRequest {
  document: { id: number };
  date: string;
  customer: { identification: string };
  seller?: number;
  stamp: { send: boolean };
  mail: { send: boolean };
  observations?: string;
  items: Array<{
    code: string;
    description?: string;
    quantity: number;
    price: number;
    discount?: number;
    taxes?: Array<{ id: number }>;
  }>;
  payments: Array<{
    id: number;
    value: number;
    due_date?: string;
  }>;
}

export interface SiigoCreateInvoiceResponse {
  id?: string;
  document?: { id: number };
  prefix?: string;
  number?: number;
  name?: string;
  date?: string;
  total?: number;
  balance?: number;
  stamp?: { send: boolean; status?: string; cufe?: string };
  mail?: { send: boolean };
  errors?: Array<{ Code: string; Message: string }>;
}

// --- Purchases (Facturas de Compra) ---

export interface SiigoPurchaseItemTax {
  id: number;
  name: string;
  type: string; // 'IVA' | 'Retefuente' | etc.
  percentage: number;
  value: number;
}

export interface SiigoPurchaseItem {
  id: string;
  type: string; // 'Account' | 'Product'
  code: string; // PUC account code (e.g., '51201001', '61350502')
  quantity: number;
  price: number;
  discount: number;
  description: string;
  total: number;
  taxes?: SiigoPurchaseItemTax[];
}

export interface SiigoPurchase {
  id: string;
  document: { id: number };
  number: number;
  name: string;
  date: string;
  supplier: {
    id: string;
    identification: string;
    branch_office: number;
  };
  total: number;
  balance: number;
  provider_invoice?: {
    prefix: string;
    number: string;
  };
  items: SiigoPurchaseItem[];
  payments?: SiigoPayment[];
  retentions?: SiigoRetention[];
  metadata?: { created?: string };
}

// --- Document Types Catalog ---

export interface SiigoDocumentType {
  id: number;
  name: string;
  type: string;
  description?: string;
  consecutive?: number;
}

// --- Create Journal Request / Response ---

export interface SiigoCreateJournalItem {
  account: {
    code: string;
    movement: 'Debit' | 'Credit';
  };
  customer?: {
    identification: string;
    branch_office?: number;
  };
  product?: {
    code: string;
    quantity?: number;
  };
  cost_center?: number;
  description: string;
  value: number;
}

export interface SiigoCreateJournalRequest {
  document: { id: number };
  date: string;
  items: SiigoCreateJournalItem[];
  observations?: string;
}

export interface SiigoCreateJournalResponse {
  id?: string;
  document?: { id: number };
  number?: number;
  name?: string;
  date?: string;
  items?: SiigoJournalItem[];
  observations?: string;
  errors?: Array<{ Code: string; Message: string }>;
}
