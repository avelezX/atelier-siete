import { NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

export const maxDuration = 60;

async function fetchAllRows(
  table: string,
  select: string,
  applyFilters?: (query: ReturnType<typeof atelierTableAdmin>) => ReturnType<typeof atelierTableAdmin>
) {
  const PAGE_SIZE = 1000;
  let allData: Record<string, unknown>[] = [];
  let from = 0;
  while (true) {
    let query = atelierTableAdmin(table).select(select).range(from, from + PAGE_SIZE - 1);
    if (applyFilters) query = applyFilters(query);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allData;
}

// Explore own inventory products and try to find their purchase cost
export async function GET() {
  try {
    // 1. Get all OWN products with stock > 0
    const products = await fetchAllRows(
      'products',
      'code, name, available_quantity, cost, sale_price, sale_price_no_iva, supplier_name, account_group_name',
      (q) => q.eq('active', true).eq('is_consignment', false).gt('available_quantity', 0)
    );

    // 2. Get ALL purchase items — to find cost per product code
    const purchaseItems = await fetchAllRows(
      'purchase_items',
      'purchase_id, account_code, description, quantity, price, tax_value, line_total'
    );

    // 3. Get purchase headers for date and supplier
    const purchases = await fetchAllRows(
      'purchases',
      'id, date, name, supplier_name, total'
    );

    const purchaseMap = new Map<string, { date: string; name: string; supplier: string }>();
    purchases.forEach((p) => {
      purchaseMap.set(p.id as string, {
        date: (p.date as string) || '',
        name: (p.name as string) || '',
        supplier: (p.supplier_name as string) || '',
      });
    });

    // 4. Get journal items for COGS (6135) to find product codes that have been sold/costed
    const cogsItems = await fetchAllRows(
      'journal_items',
      'product_code, product_name, value, journal_id, description',
      (q) => q.like('account_code', '6135%').eq('movement', 'Debit')
    );

    // 5. Get journals for date mapping
    const journals = await fetchAllRows('journals', 'id, date, name');
    const journalMap = new Map<string, { date: string; name: string }>();
    journals.forEach((j) => {
      journalMap.set(j.id as string, {
        date: (j.date as string) || '',
        name: (j.name as string) || '',
      });
    });

    // --- Analysis ---

    // Group COGS by product code to find unit cost from sales
    const cogsByProduct = new Map<string, { total_value: number; total_qty: number; entries: { date: string; value: number; journal: string }[] }>();
    cogsItems.forEach((item) => {
      const code = (item.product_code as string) || '';
      if (!code) return;
      const value = Number(item.value) || 0;
      const jInfo = journalMap.get(item.journal_id as string);
      if (!cogsByProduct.has(code)) {
        cogsByProduct.set(code, { total_value: 0, total_qty: 0, entries: [] });
      }
      const entry = cogsByProduct.get(code)!;
      entry.total_value += value;
      entry.total_qty += 1; // Each entry is typically 1 unit
      entry.entries.push({
        date: jInfo?.date || '',
        value,
        journal: jInfo?.name || '',
      });
    });

    // Try to match purchase items to product codes
    // Purchase items don't have a product_code field directly, but description might match
    // Let's look at purchase items with account 6135 (inventory purchases)
    const inventoryPurchaseItems = purchaseItems.filter((pi) => {
      const code = (pi.account_code as string) || '';
      return code.startsWith('6135') || code.startsWith('1435'); // 6135=COGS, 1435=Inventario mercancías
    });

    // Group purchase items by purchase_id to see what was bought
    const purchasesBySupplier = new Map<string, {
      supplier: string;
      purchases: {
        name: string;
        date: string;
        items: { description: string; qty: number; price: number; tax: number; total: number; account: string }[];
      }[];
    }>();

    const itemsByPurchaseId = new Map<string, typeof inventoryPurchaseItems>();
    inventoryPurchaseItems.forEach((pi) => {
      const pid = pi.purchase_id as string;
      if (!itemsByPurchaseId.has(pid)) itemsByPurchaseId.set(pid, []);
      itemsByPurchaseId.get(pid)!.push(pi);
    });

    itemsByPurchaseId.forEach((items, pid) => {
      const pInfo = purchaseMap.get(pid);
      if (!pInfo) return;
      const supplier = pInfo.supplier;
      if (!purchasesBySupplier.has(supplier)) {
        purchasesBySupplier.set(supplier, { supplier, purchases: [] });
      }
      purchasesBySupplier.get(supplier)!.purchases.push({
        name: pInfo.name,
        date: pInfo.date,
        items: items.map((i) => ({
          description: (i.description as string) || '',
          qty: Number(i.quantity) || 1,
          price: Number(i.price) || 0,
          tax: Number(i.tax_value) || 0,
          total: Number(i.line_total) || 0,
          account: (i.account_code as string) || '',
        })),
      });
    });

    // Build product detail with cost sources
    const productDetail = (products as Record<string, unknown>[]).map((p) => {
      const code = (p.code as string) || '';
      const cogs = cogsByProduct.get(code);
      const unitCost = cogs && cogs.total_qty > 0 ? cogs.total_value / cogs.total_qty : null;

      return {
        code,
        name: (p.name as string) || '',
        supplier: (p.supplier_name as string) || '',
        qty: Number(p.available_quantity) || 0,
        sale_price: Number(p.sale_price_no_iva) || Number(p.sale_price) || 0,
        cost_from_db: Number(p.cost) || null,
        // From COGS journals (6135) — this is the cost Siigo assigned when selling
        cogs_unit_cost: unitCost ? Math.round(unitCost) : null,
        cogs_entries: cogs?.entries.length || 0,
        cogs_total: cogs?.total_value || 0,
        // Estimated inventory value
        est_cost_value: unitCost ? Math.round(unitCost * (Number(p.available_quantity) || 0)) : null,
        sale_value: Math.round((Number(p.sale_price_no_iva) || Number(p.sale_price) || 0) * (Number(p.available_quantity) || 0)),
      };
    }).sort((a, b) => (b.sale_value) - (a.sale_value));

    const withCogs = productDetail.filter((p) => p.cogs_unit_cost !== null);
    const withoutCogs = productDetail.filter((p) => p.cogs_unit_cost === null);

    return NextResponse.json({
      summary: {
        total_own_products_with_stock: products.length,
        total_units: productDetail.reduce((s, p) => s + p.qty, 0),
        with_cogs_cost: withCogs.length,
        without_cogs_cost: withoutCogs.length,
        total_sale_value: productDetail.reduce((s, p) => s + p.sale_value, 0),
        total_est_cost_value: withCogs.reduce((s, p) => s + (p.est_cost_value || 0), 0),
        inventory_purchase_items_found: inventoryPurchaseItems.length,
      },
      products_with_cost: withCogs,
      products_without_cost: withoutCogs,
      // Show purchase invoices that went to inventory accounts
      inventory_purchases: Array.from(purchasesBySupplier.values())
        .sort((a, b) => b.purchases.length - a.purchases.length)
        .map((s) => ({
          supplier: s.supplier,
          purchase_count: s.purchases.length,
          purchases: s.purchases.sort((a, b) => a.date.localeCompare(b.date)).map((p) => ({
            name: p.name,
            date: p.date,
            item_count: p.items.length,
            items: p.items.slice(0, 10),
            total_value: p.items.reduce((s, i) => s + i.price * i.qty, 0),
          })),
        })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
