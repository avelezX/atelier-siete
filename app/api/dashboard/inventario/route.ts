import { NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

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

export const maxDuration = 60;

// Cost category thresholds
const MARGIN_SUSPICIOUS_THRESHOLD = -0.20; // margin worse than -20% = suspicious

type CostCategory = 'real' | 'sospechoso' | 'sin_costo';

interface ProductInventory {
  code: string;
  name: string;
  supplier: string;
  qty: number;
  sale_price: number;
  sale_value: number;
  cost_unit: number | null;
  cost_value: number | null;
  cost_category: CostCategory;
  cost_source: string;
  margin_pct: number | null;
  cogs_entries: number;
}

interface SupplierGroup {
  supplier: string;
  products: ProductInventory[];
  total_qty: number;
  total_sale_value: number;
  total_cost_value: number | null;
  products_with_cost: number;
  products_suspicious: number;
  products_no_cost: number;
}

interface MonthMovement {
  month: string;
  month_label: string;
  purchases_value: number;
  purchases_count: number;
  sales_value: number;
  sales_units: number;
  sales_count: number;
}

const MONTH_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

export async function GET() {
  try {
    // 1. Own products with stock
    const products = await fetchAllRows(
      'products',
      'code, name, available_quantity, cost, sale_price, sale_price_no_iva, supplier_name',
      (q) => q.eq('active', true).eq('is_consignment', false).gt('available_quantity', 0)
    );

    // 2. COGS journal items (6135 Debit) — cost per product code
    const cogsItems = await fetchAllRows(
      'journal_items',
      'product_code, value, journal_id',
      (q) => q.like('account_code', '6135%').eq('movement', 'Debit')
    );

    // 3. Journals for date mapping
    const journals = await fetchAllRows('journals', 'id, date');
    const journalDateMap = new Map<string, string>();
    journals.forEach((j) => {
      journalDateMap.set(j.id as string, (j.date as string) || '');
    });

    // 4. Invoice items for sales movement (by product code)
    const invoiceItems = await fetchAllRows(
      'invoice_items',
      'invoice_id, product_code, quantity, line_total, tax_value'
    );

    // 5. Invoices for date mapping (non-annulled only)
    const invoices = await fetchAllRows(
      'invoices',
      'id, date',
      (q) => q.eq('annulled', false)
    );
    const invoiceDateMap = new Map<string, string>();
    invoices.forEach((inv) => {
      invoiceDateMap.set(inv.id as string, (inv.date as string) || '');
    });
    const validInvoiceIds = new Set(invoices.map((inv) => inv.id as string));

    // 6. Purchase items with inventory accounts (6135/1435) for purchase movement
    const purchaseItems = await fetchAllRows(
      'purchase_items',
      'purchase_id, price, quantity, tax_value',
      (q) => q.or('account_code.like.6135%,account_code.like.1435%')
    );

    // 7. Purchases for date mapping
    const purchases = await fetchAllRows('purchases', 'id, date');
    const purchaseDateMap = new Map<string, string>();
    purchases.forEach((p) => {
      purchaseDateMap.set(p.id as string, (p.date as string) || '');
    });

    // === Build COGS cost per product code ===
    const cogsByCode = new Map<string, { total: number; count: number }>();
    cogsItems.forEach((item) => {
      const code = (item.product_code as string) || '';
      if (!code) return;
      const value = Number(item.value) || 0;
      if (!cogsByCode.has(code)) cogsByCode.set(code, { total: 0, count: 0 });
      const entry = cogsByCode.get(code)!;
      entry.total += value;
      entry.count += 1;
    });

    // === Build product inventory list ===
    const productList: ProductInventory[] = (products as Record<string, unknown>[]).map((p) => {
      const code = (p.code as string) || '';
      const qty = Number(p.available_quantity) || 0;
      const salePrice = Number(p.sale_price_no_iva) || Number(p.sale_price) || 0;
      const saleValue = qty * salePrice;
      const cogs = cogsByCode.get(code);
      const costUnit = cogs && cogs.count > 0 ? cogs.total / cogs.count : null;
      const costValue = costUnit !== null ? costUnit * qty : null;

      let costCategory: CostCategory = 'sin_costo';
      let marginPct: number | null = null;
      let costSource = 'Sin datos de costo';

      if (costUnit !== null) {
        marginPct = salePrice > 0 ? (1 - costUnit / salePrice) : null;
        if (marginPct !== null && marginPct < MARGIN_SUSPICIOUS_THRESHOLD) {
          costCategory = 'sospechoso';
          costSource = `COGS 6135 (${cogs!.count} ventas) — margen ${Math.round(marginPct * 100)}% sospechoso`;
        } else {
          costCategory = 'real';
          costSource = `COGS 6135 (${cogs!.count} ventas)`;
        }
      }

      return {
        code,
        name: (p.name as string) || '',
        supplier: (p.supplier_name as string) || 'Sin proveedor',
        qty,
        sale_price: salePrice,
        sale_value: saleValue,
        cost_unit: costUnit !== null ? Math.round(costUnit) : null,
        cost_value: costValue !== null ? Math.round(costValue) : null,
        cost_category: costCategory,
        cost_source: costSource,
        margin_pct: marginPct !== null ? Math.round(marginPct * 100) : null,
        cogs_entries: cogs?.count || 0,
      };
    });

    // === Group by supplier ===
    const supplierMap = new Map<string, ProductInventory[]>();
    productList.forEach((p) => {
      if (!supplierMap.has(p.supplier)) supplierMap.set(p.supplier, []);
      supplierMap.get(p.supplier)!.push(p);
    });

    const suppliers: SupplierGroup[] = Array.from(supplierMap.entries())
      .map(([supplier, prods]) => {
        const withRealCost = prods.filter((p) => p.cost_category === 'real');
        return {
          supplier,
          products: prods.sort((a, b) => b.sale_value - a.sale_value),
          total_qty: prods.reduce((s, p) => s + p.qty, 0),
          total_sale_value: prods.reduce((s, p) => s + p.sale_value, 0),
          total_cost_value: withRealCost.length > 0
            ? withRealCost.reduce((s, p) => s + (p.cost_value || 0), 0)
            : null,
          products_with_cost: withRealCost.length,
          products_suspicious: prods.filter((p) => p.cost_category === 'sospechoso').length,
          products_no_cost: prods.filter((p) => p.cost_category === 'sin_costo').length,
        };
      })
      .sort((a, b) => b.total_sale_value - a.total_sale_value);

    // === Monthly movement (purchases + sales for own products) ===
    const ownProductCodes = new Set(productList.map((p) => p.code));

    // Sales by month (only own products)
    const salesByMonth = new Map<string, { value: number; units: number; count: number }>();
    invoiceItems.forEach((ii) => {
      const invId = ii.invoice_id as string;
      if (!validInvoiceIds.has(invId)) return;
      const code = (ii.product_code as string) || '';
      // Include all sales of own-type products (even if currently zero stock)
      // We track by product code match
      const date = invoiceDateMap.get(invId);
      if (!date) return;
      const month = date.substring(0, 7);
      const lineTotal = Number(ii.line_total) || 0;
      const taxValue = Number(ii.tax_value) || 0;
      const saleNoIva = lineTotal - taxValue;
      const qty = Number(ii.quantity) || 0;
      if (!salesByMonth.has(month)) salesByMonth.set(month, { value: 0, units: 0, count: 0 });
      const entry = salesByMonth.get(month)!;
      // Only count if product is/was own
      if (ownProductCodes.has(code)) {
        entry.value += saleNoIva;
        entry.units += qty;
        entry.count += 1;
      }
    });

    // Purchases by month (inventory accounts 6135/1435)
    const purchasesByMonth = new Map<string, { value: number; count: number }>();
    purchaseItems.forEach((pi) => {
      const pid = pi.purchase_id as string;
      const date = purchaseDateMap.get(pid);
      if (!date) return;
      const month = date.substring(0, 7);
      const price = Number(pi.price) || 0;
      const qty = Number(pi.quantity) || 1;
      if (!purchasesByMonth.has(month)) purchasesByMonth.set(month, { value: 0, count: 0 });
      const entry = purchasesByMonth.get(month)!;
      entry.value += price * qty;
      entry.count += 1;
    });

    // Combine into monthly movement
    const allMonths = new Set<string>();
    salesByMonth.forEach((_, m) => allMonths.add(m));
    purchasesByMonth.forEach((_, m) => allMonths.add(m));

    const monthlyMovement: MonthMovement[] = Array.from(allMonths)
      .sort()
      .map((month) => {
        const mi = parseInt(month.split('-')[1]) - 1;
        const sales = salesByMonth.get(month);
        const purch = purchasesByMonth.get(month);
        return {
          month,
          month_label: `${MONTH_NAMES[mi]} ${month.split('-')[0]}`,
          purchases_value: purch?.value || 0,
          purchases_count: purch?.count || 0,
          sales_value: sales?.value || 0,
          sales_units: sales?.units || 0,
          sales_count: sales?.count || 0,
        };
      });

    // === Summary stats ===
    const realCost = productList.filter((p) => p.cost_category === 'real');
    const suspicious = productList.filter((p) => p.cost_category === 'sospechoso');
    const noCost = productList.filter((p) => p.cost_category === 'sin_costo');

    const summary = {
      total_products: productList.length,
      total_units: productList.reduce((s, p) => s + p.qty, 0),
      total_sale_value: productList.reduce((s, p) => s + p.sale_value, 0),
      cost_real: {
        count: realCost.length,
        units: realCost.reduce((s, p) => s + p.qty, 0),
        cost_value: realCost.reduce((s, p) => s + (p.cost_value || 0), 0),
        sale_value: realCost.reduce((s, p) => s + p.sale_value, 0),
        avg_margin: realCost.length > 0
          ? Math.round(realCost.reduce((s, p) => s + (p.margin_pct || 0), 0) / realCost.length)
          : 0,
        label: 'Costo real (COGS 6135, margen razonable)',
      },
      cost_suspicious: {
        count: suspicious.length,
        units: suspicious.reduce((s, p) => s + p.qty, 0),
        cost_value: suspicious.reduce((s, p) => s + (p.cost_value || 0), 0),
        sale_value: suspicious.reduce((s, p) => s + p.sale_value, 0),
        label: 'Costo sospechoso (COGS 6135, margen < -20%)',
      },
      cost_none: {
        count: noCost.length,
        units: noCost.reduce((s, p) => s + p.qty, 0),
        sale_value: noCost.reduce((s, p) => s + p.sale_value, 0),
        label: 'Sin costo (no hay COGS para este SKU)',
      },
      suppliers_count: suppliers.length,
    };

    return NextResponse.json({
      summary,
      suppliers,
      monthly_movement: monthlyMovement,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
