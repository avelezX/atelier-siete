import { NextResponse } from 'next/server';
import {
  fetchAllInvoices,
  fetchAllCreditNotes,
  fetchAllProducts,
  fetchAllCustomers,
  fetchAllJournals,
  fetchAllVouchers,
  fetchAllPurchases,
} from '@/lib/siigo';
import { atelierTableAdmin } from '@/lib/supabase';
import type {
  SiigoInvoice,
  SiigoCreditNote,
  SiigoProduct,
  SiigoCustomer,
  SiigoJournal,
  SiigoVoucher,
  SiigoPurchase,
} from '@/types/siigo';

export const maxDuration = 300; // 5 min timeout

const BATCH_SIZE = 500;

// =====================================================
// Transform functions: Siigo → Supabase row shape
// =====================================================

function extractSupplierNames(products: SiigoProduct[]): string[] {
  const names = new Set<string>();
  for (const p of products) {
    const ref = p.reference?.trim();
    if (ref) names.add(ref);
  }
  return Array.from(names);
}

function transformCustomer(c: SiigoCustomer) {
  return {
    siigo_id: c.id,
    identification: c.identification,
    name: c.name?.join(' ').trim() || c.commercial_name || c.identification,
    commercial_name: c.commercial_name || null,
    person_type: c.person_type,
    id_type_code: c.id_type?.code,
    id_type_name: c.id_type?.name,
    email: c.contacts?.[0]?.email || null,
    phone: c.phones?.[0]?.number || c.contacts?.[0]?.phone?.number || null,
    address: c.address?.address || null,
    city_code: c.address?.city
      ? `${c.address.city.country_code}-${c.address.city.state_code}-${c.address.city.city_code}`
      : null,
    active: c.active,
    siigo_metadata: {
      type: c.type,
      fiscal_responsibilities: c.fiscal_responsibilities,
      contacts: c.contacts,
      check_digit: c.check_digit,
      vat_responsible: c.vat_responsible,
    },
  };
}

function transformProduct(p: SiigoProduct, supplierMap: Map<string, string>) {
  const salePrice = p.prices?.[0]?.price_list?.[0]?.value || null;
  const taxPct = p.taxes?.[0]?.percentage || 19;
  const supplierName = p.reference?.trim() || null;

  return {
    siigo_id: p.id,
    code: p.code,
    name: p.name,
    account_group_id: p.account_group?.id || null,
    account_group_name: p.account_group?.name || null,
    type: p.type,
    stock_control: p.stock_control || false,
    active: p.active,
    tax_classification: p.tax_classification,
    tax_included: p.tax_included ?? true,
    tax_percentage: taxPct,
    sale_price: salePrice,
    sale_price_no_iva: salePrice
      ? Math.round((salePrice / (1 + taxPct / 100)) * 100) / 100
      : null,
    supplier_name: supplierName,
    supplier_id: supplierName ? (supplierMap.get(supplierName) || null) : null,
    available_quantity: p.available_quantity || 0,
    warehouse_name: p.warehouses?.[0]?.name || null,
    unit_code: p.unit?.code || null,
    unit_name: p.unit?.name || null,
    siigo_metadata: {
      warehouses: p.warehouses,
      prices: p.prices,
      additional_fields: p.additional_fields,
      description: p.description,
    },
  };
}

function transformInvoice(
  inv: SiigoInvoice,
  customerNameMap: Map<string, string>
) {
  const taxTotal =
    inv.items?.reduce(
      (sum, item) =>
        sum + (item.taxes?.reduce((tSum, t) => tSum + (typeof t.value === 'number' ? t.value : 0), 0) || 0),
      0
    ) || 0;

  return {
    siigo_id: inv.id,
    document_id: inv.document?.id,
    prefix: inv.prefix,
    number: inv.number,
    name: inv.name,
    date: inv.date,
    customer_siigo_id: inv.customer?.id || null,
    customer_identification: inv.customer?.identification || null,
    customer_name:
      customerNameMap.get(inv.customer?.id || '') ||
      inv.customer?.name?.join(' ') ||
      inv.customer?.identification ||
      'Desconocido',
    seller: inv.seller || null,
    currency_code: inv.currency?.code || 'COP',
    subtotal: Math.round((inv.total - taxTotal) * 100) / 100,
    tax_amount: Math.round(taxTotal * 100) / 100,
    total: inv.total,
    balance: inv.balance,
    annulled: inv.annulled || false,
    observations: inv.observations || null,
    stamp_status: inv.stamp?.status || null,
    stamp_cufe: inv.stamp?.cufe || null,
    payments: inv.payments || null,
    retentions: inv.retentions || null,
    siigo_metadata: {
      mail: inv.mail,
      cost_center: inv.cost_center,
      exchange_rate: inv.currency?.exchange_rate,
    },
  };
}

function transformInvoiceItems(
  inv: SiigoInvoice,
  invoiceDbId: string,
  productIdMap: Map<string, string>
) {
  return (inv.items || []).map((item) => ({
    invoice_id: invoiceDbId,
    siigo_item_id: item.id || null,
    product_code: item.code,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.price,
    discount_pct: typeof item.discount === 'number' ? item.discount : (item.discount as any)?.percentage || 0,
    tax_id: item.taxes?.[0]?.id || null,
    tax_name: item.taxes?.[0]?.name || null,
    tax_percentage: typeof item.taxes?.[0]?.percentage === 'number' ? item.taxes[0].percentage : null,
    tax_value: typeof item.taxes?.[0]?.value === 'number' ? item.taxes[0].value : 0,
    line_total:
      item.total ||
      item.price * item.quantity + (item.taxes?.[0]?.value || 0),
    product_id: productIdMap.get(item.code) || null,
  }));
}

function transformCreditNote(
  cn: SiigoCreditNote,
  customerNameMap: Map<string, string>
) {
  const taxTotal =
    cn.items?.reduce(
      (sum, item) =>
        sum + (item.taxes?.reduce((tSum, t) => tSum + (typeof t.value === 'number' ? t.value : 0), 0) || 0),
      0
    ) || 0;

  return {
    siigo_id: cn.id,
    document_id: cn.document?.id,
    prefix: cn.prefix,
    number: cn.number,
    name: cn.name,
    date: cn.date,
    customer_siigo_id: cn.customer?.id || null,
    customer_identification: cn.customer?.identification || null,
    customer_name:
      customerNameMap.get(cn.customer?.id || '') ||
      cn.customer?.name?.join(' ') ||
      cn.customer?.identification ||
      'Desconocido',
    original_invoice_siigo_id: cn.invoice?.id || null,
    original_invoice_name: cn.invoice?.name || null,
    subtotal: Math.round((cn.total - taxTotal) * 100) / 100,
    tax_amount: Math.round(taxTotal * 100) / 100,
    total: cn.total,
    observations: cn.observations || null,
    stamp_status: cn.stamp?.status || null,
    siigo_metadata: {
      stamp: cn.stamp,
    },
  };
}

function transformCreditNoteItems(
  cn: SiigoCreditNote,
  cnDbId: string,
  productIdMap: Map<string, string>
) {
  return (cn.items || []).map((item) => ({
    credit_note_id: cnDbId,
    siigo_item_id: item.id || null,
    product_code: item.code,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.price,
    tax_id: item.taxes?.[0]?.id || null,
    tax_name: item.taxes?.[0]?.name || null,
    tax_percentage: typeof item.taxes?.[0]?.percentage === 'number' ? item.taxes[0].percentage : null,
    tax_value: typeof item.taxes?.[0]?.value === 'number' ? item.taxes[0].value : 0,
    line_total:
      item.total ||
      item.price * item.quantity + (typeof item.taxes?.[0]?.value === 'number' ? item.taxes[0].value : 0),
    product_id: productIdMap.get(item.code) || null,
  }));
}

// =====================================================
// Batch upsert helper
// =====================================================
async function upsertBatch(
  table: string,
  rows: Record<string, unknown>[],
  conflictColumn: string
): Promise<number> {
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await atelierTableAdmin(table).upsert(batch, {
      onConflict: conflictColumn,
    });
    if (error) throw new Error(`Upsert ${table} batch ${i}: ${error.message}`);
    total += batch.length;
  }
  return total;
}

async function insertBatch(
  table: string,
  rows: Record<string, unknown>[]
): Promise<number> {
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await atelierTableAdmin(table).insert(batch);
    if (error) throw new Error(`Insert ${table} batch ${i}: ${error.message}`);
    total += batch.length;
  }
  return total;
}

// =====================================================
// Main sync handler
// =====================================================
export async function POST() {
  const counts = {
    suppliers: 0,
    customers: 0,
    products: 0,
    invoices: 0,
    invoice_items: 0,
    credit_notes: 0,
    credit_note_items: 0,
    journals: 0,
    journal_items: 0,
    vouchers: 0,
    voucher_items: 0,
    purchases: 0,
    purchase_items: 0,
  };

  // 1. Create sync log entry
  const { data: syncLog, error: logError } = await atelierTableAdmin('sync_log')
    .insert({ sync_type: 'full', entity: 'all', status: 'running' })
    .select('id')
    .single();

  if (logError) {
    return NextResponse.json(
      { error: `Error creando sync log: ${logError.message}` },
      { status: 500 }
    );
  }
  const syncId = syncLog.id;

  try {
    // 2. Fetch ALL data from Siigo in parallel
    const [siigoProducts, siigoCustomers, siigoInvoices, siigoCreditNotes, siigoJournals, siigoVouchers, siigoPurchases] =
      await Promise.all([
        fetchAllProducts(),
        fetchAllCustomers(),
        fetchAllInvoices(),
        fetchAllCreditNotes(),
        fetchAllJournals(),
        fetchAllVouchers(),
        fetchAllPurchases(),
      ]);

    const totalFetched =
      siigoProducts.length +
      siigoCustomers.length +
      siigoInvoices.length +
      siigoCreditNotes.length +
      siigoJournals.length +
      siigoVouchers.length +
      siigoPurchases.length;

    // 3. Upsert suppliers (from product.reference)
    const supplierNames = extractSupplierNames(siigoProducts);
    if (supplierNames.length > 0) {
      const supplierRows = supplierNames.map((name) => ({ name }));
      // Use individual upserts to handle existing rows with extra data
      for (const row of supplierRows) {
        await atelierTableAdmin('suppliers').upsert(row, {
          onConflict: 'name',
          ignoreDuplicates: true,
        });
      }
      counts.suppliers = supplierNames.length;
    }

    // Build supplier name → id map
    const { data: dbSuppliers } = await atelierTableAdmin('suppliers').select(
      'id, name'
    );
    const supplierMap = new Map<string, string>();
    (dbSuppliers || []).forEach(
      (s: { id: string; name: string }) => supplierMap.set(s.name, s.id)
    );

    // 4. Upsert customers
    const customerRows = siigoCustomers.map(transformCustomer);
    counts.customers = await upsertBatch('customers', customerRows, 'siigo_id');

    // Build customer siigo_id → name map
    const customerNameMap = new Map<string, string>();
    siigoCustomers.forEach((c) => {
      customerNameMap.set(c.id, c.name?.join(' ').trim() || c.identification);
    });

    // 5. Upsert products
    const productRows = siigoProducts.map((p) =>
      transformProduct(p, supplierMap)
    );
    counts.products = await upsertBatch('products', productRows, 'siigo_id');

    // Build product code → DB id map
    const { data: dbProducts } = await atelierTableAdmin('products').select(
      'id, code'
    );
    const productIdMap = new Map<string, string>();
    (dbProducts || []).forEach(
      (p: { id: string; code: string }) => productIdMap.set(p.code, p.id)
    );

    // 6. Upsert invoices (headers)
    const invoiceRows = siigoInvoices.map((inv) =>
      transformInvoice(inv, customerNameMap)
    );
    counts.invoices = await upsertBatch('invoices', invoiceRows, 'siigo_id');

    // 7. Sync invoice items (delete + reinsert per invoice)
    // Get all invoice DB ids
    const { data: dbInvoices } = await atelierTableAdmin('invoices').select(
      'id, siigo_id'
    );
    const invoiceDbMap = new Map<string, string>();
    (dbInvoices || []).forEach(
      (i: { id: string; siigo_id: string }) =>
        invoiceDbMap.set(i.siigo_id, i.id)
    );

    // Delete all existing invoice items and reinsert
    await atelierTableAdmin('invoice_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const allInvoiceItems: Record<string, unknown>[] = [];
    for (const inv of siigoInvoices) {
      const dbId = invoiceDbMap.get(inv.id);
      if (dbId && inv.items?.length) {
        allInvoiceItems.push(
          ...transformInvoiceItems(inv, dbId, productIdMap)
        );
      }
    }
    if (allInvoiceItems.length > 0) {
      counts.invoice_items = await insertBatch('invoice_items', allInvoiceItems);
    }

    // 8. Upsert credit notes (headers)
    const cnRows = siigoCreditNotes.map((cn) =>
      transformCreditNote(cn, customerNameMap)
    );
    counts.credit_notes = await upsertBatch(
      'credit_notes',
      cnRows,
      'siigo_id'
    );

    // 9. Sync credit note items (same pattern)
    const { data: dbCreditNotes } = await atelierTableAdmin(
      'credit_notes'
    ).select('id, siigo_id');
    const cnDbMap = new Map<string, string>();
    (dbCreditNotes || []).forEach(
      (cn: { id: string; siigo_id: string }) =>
        cnDbMap.set(cn.siigo_id, cn.id)
    );

    await atelierTableAdmin('credit_note_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const allCnItems: Record<string, unknown>[] = [];
    for (const cn of siigoCreditNotes) {
      const dbId = cnDbMap.get(cn.id);
      if (dbId && cn.items?.length) {
        allCnItems.push(
          ...transformCreditNoteItems(cn, dbId, productIdMap)
        );
      }
    }
    if (allCnItems.length > 0) {
      counts.credit_note_items = await insertBatch(
        'credit_note_items',
        allCnItems
      );
    }

    // 10. Sync journals (comprobantes contables)
    const journalRows = siigoJournals.map((j: SiigoJournal) => ({
      siigo_id: j.id,
      document_id: j.document?.id,
      number: j.number,
      name: j.name,
      date: j.date,
      observations: j.observations || null,
      siigo_metadata: { created: j.metadata?.created },
    }));
    counts.journals = await upsertBatch('journals', journalRows, 'siigo_id');

    // Get journal DB ids
    const { data: dbJournals } = await atelierTableAdmin('journals').select('id, siigo_id');
    const journalDbMap = new Map<string, string>();
    (dbJournals || []).forEach(
      (j: { id: string; siigo_id: string }) => journalDbMap.set(j.siigo_id, j.id)
    );

    // Delete + reinsert journal items
    await atelierTableAdmin('journal_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const allJournalItems: Record<string, unknown>[] = [];
    for (const j of siigoJournals) {
      const dbId = journalDbMap.get(j.id);
      if (dbId && j.items?.length) {
        for (const item of j.items) {
          allJournalItems.push({
            journal_id: dbId,
            account_code: item.account?.code || 'unknown',
            movement: item.account?.movement || 'Debit',
            customer_siigo_id: item.customer?.id || null,
            customer_identification: item.customer?.identification || null,
            product_siigo_id: item.product?.id || null,
            product_code: item.product?.code || null,
            product_name: item.product?.name || null,
            product_quantity: item.product?.quantity || null,
            description: item.description || null,
            value: item.value || 0,
          });
        }
      }
    }
    if (allJournalItems.length > 0) {
      counts.journal_items = await insertBatch('journal_items', allJournalItems);
    }

    // 11. Sync vouchers (recibos de caja)
    const voucherRows = siigoVouchers.map((v: SiigoVoucher) => ({
      siigo_id: v.id,
      document_id: v.document?.id,
      number: v.number,
      name: v.name,
      date: v.date,
      type: v.type || null,
      observations: v.observations || null,
      siigo_metadata: { created: v.metadata?.created },
    }));
    counts.vouchers = await upsertBatch('vouchers', voucherRows, 'siigo_id');

    // Get voucher DB ids
    const { data: dbVouchers } = await atelierTableAdmin('vouchers').select('id, siigo_id');
    const voucherDbMap = new Map<string, string>();
    (dbVouchers || []).forEach(
      (v: { id: string; siigo_id: string }) => voucherDbMap.set(v.siigo_id, v.id)
    );

    // Delete + reinsert voucher items
    await atelierTableAdmin('voucher_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const allVoucherItems: Record<string, unknown>[] = [];
    for (const v of siigoVouchers) {
      const dbId = voucherDbMap.get(v.id);
      if (dbId && v.items?.length) {
        for (const item of v.items) {
          allVoucherItems.push({
            voucher_id: dbId,
            account_code: item.account?.code || 'unknown',
            movement: item.account?.movement || 'Debit',
            customer_siigo_id: item.customer?.id || null,
            customer_identification: item.customer?.identification || null,
            description: item.description || null,
            value: item.value || 0,
          });
        }
      }
    }
    if (allVoucherItems.length > 0) {
      counts.voucher_items = await insertBatch('voucher_items', allVoucherItems);
    }

    // 12. Sync purchases (facturas de compra)
    // Build supplier identification → name map from customers
    const supplierNameByIdent = new Map<string, string>();
    siigoCustomers.forEach((c: SiigoCustomer) => {
      const name = c.commercial_name || c.name?.join(' ').trim() || c.identification;
      supplierNameByIdent.set(c.identification, name);
    });

    const purchaseRows = siigoPurchases.map((p: SiigoPurchase) => {
      // Calculate subtotal and tax from items
      let subtotal = 0;
      let taxAmount = 0;
      let retentionAmount = 0;
      for (const item of p.items || []) {
        subtotal += item.price * (item.quantity || 1);
        for (const tax of item.taxes || []) {
          if (tax.type === 'IVA') taxAmount += tax.value;
          else retentionAmount += tax.value;
        }
      }
      return {
        siigo_id: p.id,
        document_id: p.document?.id,
        number: p.number,
        name: p.name,
        date: p.date,
        supplier_siigo_id: p.supplier?.id || null,
        supplier_identification: p.supplier?.identification || null,
        supplier_name: supplierNameByIdent.get(p.supplier?.identification) || null,
        subtotal,
        tax_amount: taxAmount,
        retention_amount: retentionAmount,
        total: p.total,
        balance: p.balance || 0,
        provider_invoice_prefix: p.provider_invoice?.prefix || null,
        provider_invoice_number: p.provider_invoice?.number || null,
        siigo_metadata: { created: p.metadata?.created },
      };
    });
    counts.purchases = await upsertBatch('purchases', purchaseRows, 'siigo_id');

    // Get purchase DB ids
    const { data: dbPurchases } = await atelierTableAdmin('purchases').select('id, siigo_id');
    const purchaseDbMap = new Map<string, string>();
    (dbPurchases || []).forEach(
      (p: { id: string; siigo_id: string }) => purchaseDbMap.set(p.siigo_id, p.id)
    );

    // Delete + reinsert purchase items
    await atelierTableAdmin('purchase_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const allPurchaseItems: Record<string, unknown>[] = [];
    for (const p of siigoPurchases) {
      const dbId = purchaseDbMap.get(p.id);
      if (dbId && p.items?.length) {
        for (const item of p.items) {
          const ivaTax = item.taxes?.find(t => t.type === 'IVA');
          const retention = item.taxes?.find(t => t.type !== 'IVA');
          const itemType = item.type || null; // 'Product', 'Account', 'FixedAsset'
          const isProduct = itemType === 'Product';
          allPurchaseItems.push({
            purchase_id: dbId,
            siigo_item_id: item.id || null,
            item_type: itemType,
            account_code: isProduct ? 'product' : (item.code || 'unknown'),
            product_code: isProduct ? (item.code || null) : null,
            description: item.description || null,
            quantity: item.quantity || 1,
            price: item.price || 0,
            discount: item.discount || 0,
            tax_name: ivaTax?.name || null,
            tax_percentage: ivaTax?.percentage || 0,
            tax_value: ivaTax?.value || 0,
            retention_name: retention?.name || null,
            retention_percentage: retention?.percentage || 0,
            retention_value: retention?.value || 0,
            line_total: item.total || 0,
          });
        }
      }
    }
    if (allPurchaseItems.length > 0) {
      counts.purchase_items = await insertBatch('purchase_items', allPurchaseItems);
    }

    // 13. Update sync log
    await atelierTableAdmin('sync_log')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        records_fetched: totalFetched,
        records_upserted:
          counts.suppliers +
          counts.customers +
          counts.products +
          counts.invoices +
          counts.invoice_items +
          counts.credit_notes +
          counts.credit_note_items +
          counts.journals +
          counts.journal_items +
          counts.vouchers +
          counts.voucher_items +
          counts.purchases +
          counts.purchase_items,
        details: counts,
      })
      .eq('id', syncId);

    return NextResponse.json({
      success: true,
      message: 'Sincronizacion completada',
      counts,
      totalFetched,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    await atelierTableAdmin('sync_log')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: message,
        details: counts,
      })
      .eq('id', syncId);

    return NextResponse.json(
      { success: false, error: message, counts },
      { status: 500 }
    );
  }
}
