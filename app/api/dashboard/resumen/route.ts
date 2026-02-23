import { NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

// Fetch all rows handling Supabase 1000 row limit
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

interface MonthData {
  month: string;
  ventas_brutas: number;
  notas_credito: number;
  ventas_netas: number;
  costo_ventas: number;
  utilidad_bruta: number;
  margen_bruto_pct: number;
  gastos_admin: number;
  gastos_venta: number;
  gastos_financieros: number;
  total_gastos: number;
  utilidad_operativa: number;
  iva_generado: number;
  iva_nc: number;
  iva_descontable: number;
  iva_neto: number;
  renta_estimada: number;
  invoices_count: number;
  cn_count: number;
}

// Individual expense item for the expandable detail view
interface ExpenseItem {
  source: 'CC' | 'FC'; // Comprobante Contable vs Factura de Compra
  document_name: string;
  date: string;
  account_code: string;
  description: string;
  supplier_name: string | null;
  value: number;
}

// Subcategory (e.g., 5120 Arrendamientos)
interface ExpenseSubcategory {
  account_prefix: string; // 4-digit prefix
  category: string; // Human-readable name
  total: number;
  entries: number;
  items: ExpenseItem[];
}

// Top-level group (51xx Admin, 52xx Ventas, 53xx Financieros)
interface ExpenseGroup {
  group: string; // 'admin' | 'venta' | 'financieros'
  group_label: string;
  total: number;
  entries: number;
  subcategories: ExpenseSubcategory[];
}

// Revenue by supplier
interface RevenueItem {
  invoice_name: string;
  date: string;
  customer_name: string;
  product_code: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface SupplierRevenue {
  supplier_name: string;
  total: number;
  items_count: number;
  products_count: number;
  items: RevenueItem[];
}

// GET /api/dashboard/resumen
export async function GET() {
  try {
    // 1. Fetch all invoices (non-annulled) — includes id/name/customer for supplier breakdown
    const invoices = await fetchAllRows(
      'invoices',
      'id, date, name, customer_name, total, subtotal, tax_amount, annulled',
      (q) => q.eq('annulled', false)
    );

    // 2. Fetch all credit notes
    const creditNotes = await fetchAllRows(
      'credit_notes',
      'date, total, subtotal, tax_amount'
    );

    // 3. Fetch journal items for COGS (account 6135*)
    const costoVentas = await fetchAllRows(
      'journal_items',
      'account_code, movement, value, journal_id, product_code, description',
      (q) => q.like('account_code', '6135%').eq('movement', 'Debit')
    );

    // 4. Fetch journal headers for date mapping
    const journals = await fetchAllRows(
      'journals',
      'id, date, name'
    );

    const journalDateMap = new Map<string, string>();
    const journalNameMap = new Map<string, string>();
    journals.forEach((j) => {
      journalDateMap.set(j.id as string, (j.date as string) || '');
      journalNameMap.set(j.id as string, (j.name as string) || '');
    });

    // 5. Fetch journal items for expenses (accounts 51xx, 52xx, 53xx)
    const gastosJournal = await fetchAllRows(
      'journal_items',
      'account_code, movement, value, journal_id, description',
      (q) => q.like('account_code', '5%').eq('movement', 'Debit')
    );

    // 6. Fetch journal items for IVA descontable (account 2408, Debit)
    const ivaDescontableJournal = await fetchAllRows(
      'journal_items',
      'account_code, movement, value, journal_id',
      (q) => q.like('account_code', '2408%').eq('movement', 'Debit')
    );

    // 7. Fetch purchase headers for date/supplier mapping
    const purchases = await fetchAllRows(
      'purchases',
      'id, date, name, supplier_name'
    );

    const purchaseDateMap = new Map<string, string>();
    const purchaseNameMap = new Map<string, string>();
    const purchaseSupplierMap = new Map<string, string>();
    purchases.forEach((p) => {
      purchaseDateMap.set(p.id as string, (p.date as string) || '');
      purchaseNameMap.set(p.id as string, (p.name as string) || '');
      purchaseSupplierMap.set(p.id as string, (p.supplier_name as string) || '');
    });

    // 8. Fetch purchase items for expenses (accounts 5xxx) — gastos from purchases
    const gastosPurchase = await fetchAllRows(
      'purchase_items',
      'account_code, price, tax_value, purchase_id, description, quantity',
      (q) => q.like('account_code', '5%')
    );

    // 9. Fetch purchase items for IVA descontable (all purchase IVA)
    const ivaPurchase = await fetchAllRows(
      'purchase_items',
      'tax_value, purchase_id',
      (q) => q.gt('tax_value', 0)
    );

    // 10. Fetch invoice items for revenue by supplier
    const invoiceItems = await fetchAllRows(
      'invoice_items',
      'invoice_id, product_code, quantity, unit_price, line_total'
    );

    // 11. Fetch products for supplier mapping
    const products = await fetchAllRows(
      'products',
      'code, name, supplier_name'
    );

    const productSupplierMap = new Map<string, string>();
    const productNameMap = new Map<string, string>();
    products.forEach((p) => {
      productSupplierMap.set(p.code as string, (p.supplier_name as string) || 'SIN PROVEEDOR');
      productNameMap.set(p.code as string, (p.name as string) || '');
    });

    // Build invoice header maps for supplier revenue breakdown
    const invoiceDateMap = new Map<string, string>();
    const invoiceNameMap = new Map<string, string>();
    const invoiceCustomerMap = new Map<string, string>();
    invoices.forEach((inv) => {
      invoiceDateMap.set(inv.id as string, (inv.date as string) || '');
      invoiceNameMap.set(inv.id as string, (inv.name as string) || '');
      invoiceCustomerMap.set(inv.id as string, (inv.customer_name as string) || '');
    });

    // --- Group invoices by month ---
    const invoicesByMonth = new Map<string, { total: number; subtotal: number; tax: number; count: number }>();
    invoices.forEach((inv) => {
      const month = (inv.date as string)?.substring(0, 7);
      if (!month) return;
      const curr = invoicesByMonth.get(month) || { total: 0, subtotal: 0, tax: 0, count: 0 };
      curr.total += Number(inv.total) || 0;
      curr.subtotal += Number(inv.subtotal) || 0;
      curr.tax += Number(inv.tax_amount) || 0;
      curr.count += 1;
      invoicesByMonth.set(month, curr);
    });

    // --- Group credit notes by month ---
    const cnByMonth = new Map<string, { total: number; tax: number; count: number }>();
    creditNotes.forEach((cn) => {
      const month = (cn.date as string)?.substring(0, 7);
      if (!month) return;
      const curr = cnByMonth.get(month) || { total: 0, tax: 0, count: 0 };
      curr.total += Number(cn.total) || 0;
      curr.tax += Number(cn.tax_amount) || 0;
      curr.count += 1;
      cnByMonth.set(month, curr);
    });

    // --- Group COGS by month (from journals) ---
    const cogsByMonth = new Map<string, number>();
    costoVentas.forEach((item) => {
      const journalDate = journalDateMap.get(item.journal_id as string);
      const month = journalDate?.substring(0, 7);
      if (!month) return;
      cogsByMonth.set(month, (cogsByMonth.get(month) || 0) + (Number(item.value) || 0));
    });

    // --- Collect ALL expense items (from journals + purchases) ---
    // This is used for both monthly totals AND the detailed expandable view
    interface RawExpense {
      month: string;
      account_code: string;
      value: number; // price (sin IVA) for purchases, value for journals
      source: 'CC' | 'FC';
      document_name: string;
      date: string;
      description: string;
      supplier_name: string | null;
    }

    const allExpenses: RawExpense[] = [];

    // From journal items (CC)
    gastosJournal.forEach((item) => {
      const journalDate = journalDateMap.get(item.journal_id as string);
      const month = journalDate?.substring(0, 7);
      if (!month) return;
      allExpenses.push({
        month,
        account_code: item.account_code as string,
        value: Number(item.value) || 0,
        source: 'CC',
        document_name: journalNameMap.get(item.journal_id as string) || '',
        date: journalDate || '',
        description: (item.description as string) || '',
        supplier_name: null,
      });
    });

    // From purchase items (FC) — use price (base, sin IVA) as the expense value
    gastosPurchase.forEach((item) => {
      const purchaseDate = purchaseDateMap.get(item.purchase_id as string);
      const month = purchaseDate?.substring(0, 7);
      if (!month) return;
      const qty = Number(item.quantity) || 1;
      allExpenses.push({
        month,
        account_code: item.account_code as string,
        value: (Number(item.price) || 0) * qty,
        source: 'FC',
        document_name: purchaseNameMap.get(item.purchase_id as string) || '',
        date: purchaseDate || '',
        description: (item.description as string) || '',
        supplier_name: purchaseSupplierMap.get(item.purchase_id as string) || null,
      });
    });

    // --- Group expenses by month for P&L ---
    const gastosByMonth = new Map<string, { admin: number; venta: number; financieros: number }>();
    allExpenses.forEach((exp) => {
      const curr = gastosByMonth.get(exp.month) || { admin: 0, venta: 0, financieros: 0 };
      if (exp.account_code.startsWith('51')) {
        curr.admin += exp.value;
      } else if (exp.account_code.startsWith('52')) {
        curr.venta += exp.value;
      } else if (exp.account_code.startsWith('53')) {
        curr.financieros += exp.value;
      }
      gastosByMonth.set(exp.month, curr);
    });

    // --- Group IVA descontable by month (journals + purchases) ---
    const ivaDescByMonth = new Map<string, number>();
    ivaDescontableJournal.forEach((item) => {
      const journalDate = journalDateMap.get(item.journal_id as string);
      const month = journalDate?.substring(0, 7);
      if (!month) return;
      ivaDescByMonth.set(month, (ivaDescByMonth.get(month) || 0) + (Number(item.value) || 0));
    });
    ivaPurchase.forEach((item) => {
      const purchaseDate = purchaseDateMap.get(item.purchase_id as string);
      const month = purchaseDate?.substring(0, 7);
      if (!month) return;
      ivaDescByMonth.set(month, (ivaDescByMonth.get(month) || 0) + (Number(item.tax_value) || 0));
    });

    // --- Collect all months ---
    const allMonths = new Set<string>();
    invoicesByMonth.forEach((_, m) => allMonths.add(m));
    cnByMonth.forEach((_, m) => allMonths.add(m));
    cogsByMonth.forEach((_, m) => allMonths.add(m));
    gastosByMonth.forEach((_, m) => allMonths.add(m));

    const sortedMonths = Array.from(allMonths).sort();

    // --- Build monthly P&L data ---
    const months: MonthData[] = sortedMonths.map((month) => {
      const inv = invoicesByMonth.get(month) || { total: 0, subtotal: 0, tax: 0, count: 0 };
      const cn = cnByMonth.get(month) || { total: 0, tax: 0, count: 0 };
      const cogs = cogsByMonth.get(month) || 0;
      const gst = gastosByMonth.get(month) || { admin: 0, venta: 0, financieros: 0 };
      const ivaDesc = ivaDescByMonth.get(month) || 0;

      const ventasNetas = inv.subtotal - cn.total;
      const utilidadBruta = ventasNetas - cogs;
      const totalGastos = gst.admin + gst.venta + gst.financieros;
      const utilidadOperativa = utilidadBruta - totalGastos;

      const ivaGenerado = inv.tax;
      const ivaNc = cn.tax;
      const ivaNeto = ivaGenerado - ivaNc - ivaDesc;

      const baseRenta = Math.max(utilidadOperativa, 0);
      const rentaEstimada = baseRenta * 0.35;

      return {
        month,
        ventas_brutas: inv.subtotal,
        notas_credito: cn.total,
        ventas_netas: ventasNetas,
        costo_ventas: cogs,
        utilidad_bruta: utilidadBruta,
        margen_bruto_pct: ventasNetas > 0 ? (utilidadBruta / ventasNetas) * 100 : 0,
        gastos_admin: gst.admin,
        gastos_venta: gst.venta,
        gastos_financieros: gst.financieros,
        total_gastos: totalGastos,
        utilidad_operativa: utilidadOperativa,
        iva_generado: ivaGenerado,
        iva_nc: ivaNc,
        iva_descontable: ivaDesc,
        iva_neto: ivaNeto,
        renta_estimada: rentaEstimada,
        invoices_count: inv.count,
        cn_count: cn.count,
      };
    });

    // --- Totals across all months ---
    const totals: MonthData = months.reduce(
      (acc, m) => ({
        month: 'TOTAL',
        ventas_brutas: acc.ventas_brutas + m.ventas_brutas,
        notas_credito: acc.notas_credito + m.notas_credito,
        ventas_netas: acc.ventas_netas + m.ventas_netas,
        costo_ventas: acc.costo_ventas + m.costo_ventas,
        utilidad_bruta: acc.utilidad_bruta + m.utilidad_bruta,
        margen_bruto_pct: 0,
        gastos_admin: acc.gastos_admin + m.gastos_admin,
        gastos_venta: acc.gastos_venta + m.gastos_venta,
        gastos_financieros: acc.gastos_financieros + m.gastos_financieros,
        total_gastos: acc.total_gastos + m.total_gastos,
        utilidad_operativa: acc.utilidad_operativa + m.utilidad_operativa,
        iva_generado: acc.iva_generado + m.iva_generado,
        iva_nc: acc.iva_nc + m.iva_nc,
        iva_descontable: acc.iva_descontable + m.iva_descontable,
        iva_neto: acc.iva_neto + m.iva_neto,
        renta_estimada: acc.renta_estimada + m.renta_estimada,
        invoices_count: acc.invoices_count + m.invoices_count,
        cn_count: acc.cn_count + m.cn_count,
      }),
      {
        month: 'TOTAL',
        ventas_brutas: 0, notas_credito: 0, ventas_netas: 0, costo_ventas: 0,
        utilidad_bruta: 0, margen_bruto_pct: 0, gastos_admin: 0, gastos_venta: 0,
        gastos_financieros: 0, total_gastos: 0, utilidad_operativa: 0,
        iva_generado: 0, iva_nc: 0, iva_descontable: 0, iva_neto: 0,
        renta_estimada: 0, invoices_count: 0, cn_count: 0,
      }
    );
    totals.margen_bruto_pct = totals.ventas_netas > 0
      ? (totals.utilidad_bruta / totals.ventas_netas) * 100
      : 0;

    // --- Build detailed expense groups for expandable UI ---
    // Group by: top-level (51/52/53) → subcategory (4-digit) → individual items
    const expenseGroupMap = new Map<string, Map<string, ExpenseItem[]>>();

    allExpenses.forEach((exp) => {
      const topPrefix = exp.account_code.substring(0, 2); // '51', '52', '53'
      const subPrefix = exp.account_code.substring(0, 4); // '5120', '5135', etc.

      if (!expenseGroupMap.has(topPrefix)) {
        expenseGroupMap.set(topPrefix, new Map());
      }
      const subMap = expenseGroupMap.get(topPrefix)!;
      if (!subMap.has(subPrefix)) {
        subMap.set(subPrefix, []);
      }
      subMap.get(subPrefix)!.push({
        source: exp.source,
        document_name: exp.document_name,
        date: exp.date,
        account_code: exp.account_code,
        description: exp.description,
        supplier_name: exp.supplier_name,
        value: exp.value,
      });
    });

    const groupLabels: Record<string, { group: string; label: string }> = {
      '51': { group: 'admin', label: 'Gastos de Administracion' },
      '52': { group: 'venta', label: 'Gastos de Ventas' },
      '53': { group: 'financieros', label: 'Gastos Financieros / No Operacionales' },
    };

    const gastos_groups: ExpenseGroup[] = [];
    for (const [topPrefix, subMap] of expenseGroupMap) {
      const gl = groupLabels[topPrefix] || { group: topPrefix, label: `Otros (${topPrefix}xx)` };
      const subcategories: ExpenseSubcategory[] = [];

      for (const [subPrefix, items] of subMap) {
        const total = items.reduce((s, i) => s + i.value, 0);
        subcategories.push({
          account_prefix: subPrefix,
          category: getExpenseCategory(subPrefix),
          total,
          entries: items.length,
          items: items.sort((a, b) => b.value - a.value),
        });
      }

      subcategories.sort((a, b) => b.total - a.total);
      const groupTotal = subcategories.reduce((s, sc) => s + sc.total, 0);
      const groupEntries = subcategories.reduce((s, sc) => s + sc.entries, 0);

      gastos_groups.push({
        group: gl.group,
        group_label: gl.label,
        total: groupTotal,
        entries: groupEntries,
        subcategories,
      });
    }
    gastos_groups.sort((a, b) => b.total - a.total);

    // --- Build revenue by supplier ---
    const supplierRevenueMap = new Map<string, { total: number; products: Set<string>; items: RevenueItem[] }>();

    // Only include items from non-annulled invoices (invoiceHeaders already filtered)
    const validInvoiceIds = new Set(invoices.map((inv) => inv.id as string));

    invoiceItems.forEach((item) => {
      const invoiceId = item.invoice_id as string;
      if (!validInvoiceIds.has(invoiceId)) return;

      const productCode = item.product_code as string;
      const supplierName = productSupplierMap.get(productCode) || 'SIN PROVEEDOR';
      const qty = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const subtotal = unitPrice * qty; // sin IVA

      if (!supplierRevenueMap.has(supplierName)) {
        supplierRevenueMap.set(supplierName, { total: 0, products: new Set(), items: [] });
      }
      const entry = supplierRevenueMap.get(supplierName)!;
      entry.total += subtotal;
      entry.products.add(productCode);
      entry.items.push({
        invoice_name: invoiceNameMap.get(invoiceId) || '',
        date: invoiceDateMap.get(invoiceId) || '',
        customer_name: invoiceCustomerMap.get(invoiceId) || '',
        product_code: productCode,
        product_name: productNameMap.get(productCode) || productCode,
        quantity: qty,
        unit_price: unitPrice,
        line_total: subtotal, // sin IVA
      });
    });

    const ventas_by_supplier: SupplierRevenue[] = [];
    for (const [name, entry] of supplierRevenueMap) {
      ventas_by_supplier.push({
        supplier_name: name,
        total: entry.total,
        items_count: entry.items.length,
        products_count: entry.products.size,
        items: entry.items.sort((a, b) => b.line_total - a.line_total),
      });
    }
    ventas_by_supplier.sort((a, b) => b.total - a.total);

    // --- Build row_details for inline expandable rows ---
    interface RowBreakdown {
      label: string;
      by_month: Record<string, number>;
      total: number;
    }

    function buildTopBreakdowns(
      items: Array<{ key: string; month: string; value: number }>,
      labelMap: Record<string, string> | ((key: string) => string),
      topN: number = 4,
    ): RowBreakdown[] {
      // Group by key → { by_month, total }
      const grouped = new Map<string, { by_month: Map<string, number>; total: number }>();
      for (const item of items) {
        if (!grouped.has(item.key)) {
          grouped.set(item.key, { by_month: new Map(), total: 0 });
        }
        const g = grouped.get(item.key)!;
        g.by_month.set(item.month, (g.by_month.get(item.month) || 0) + item.value);
        g.total += item.value;
      }

      // Sort by total desc, take top N + "Otros"
      const sorted = Array.from(grouped.entries()).sort((a, b) => b[1].total - a[1].total);
      const top = sorted.slice(0, topN);
      const rest = sorted.slice(topN);

      const results: RowBreakdown[] = top.map(([key, data]) => ({
        label: typeof labelMap === 'function' ? labelMap(key) : (labelMap[key] || key),
        by_month: Object.fromEntries(data.by_month),
        total: data.total,
      }));

      if (rest.length > 0) {
        const othersByMonth = new Map<string, number>();
        let othersTotal = 0;
        for (const [, data] of rest) {
          othersTotal += data.total;
          for (const [m, v] of data.by_month) {
            othersByMonth.set(m, (othersByMonth.get(m) || 0) + v);
          }
        }
        results.push({
          label: `Otros (${rest.length})`,
          by_month: Object.fromEntries(othersByMonth),
          total: othersTotal,
        });
      }

      return results;
    }

    // Ventas Brutas by supplier
    const ventasItems: Array<{ key: string; month: string; value: number }> = [];
    invoiceItems.forEach((item) => {
      const invoiceId = item.invoice_id as string;
      if (!validInvoiceIds.has(invoiceId)) return;
      const productCode = item.product_code as string;
      const supplierName = productSupplierMap.get(productCode) || 'SIN PROVEEDOR';
      const month = invoiceDateMap.get(invoiceId)?.substring(0, 7);
      if (!month) return;
      ventasItems.push({
        key: supplierName,
        month,
        value: (Number(item.unit_price) || 0) * (Number(item.quantity) || 0),
      });
    });

    // Costo de Ventas by supplier (via product_code → productSupplierMap)
    const cogsItems: Array<{ key: string; month: string; value: number }> = [];
    costoVentas.forEach((item) => {
      const journalDate = journalDateMap.get(item.journal_id as string);
      const month = journalDate?.substring(0, 7);
      if (!month) return;
      const productCode = (item.product_code as string) || '';
      const supplierName = productCode ? (productSupplierMap.get(productCode) || 'SIN PROVEEDOR') : 'SIN PRODUCTO';
      cogsItems.push({ key: supplierName, month, value: Number(item.value) || 0 });
    });

    // Gastos by subcategory (reuse allExpenses)
    function expenseBreakdown(prefix: string): RowBreakdown[] {
      const items = allExpenses
        .filter((e) => e.account_code.startsWith(prefix))
        .map((e) => ({
          key: e.account_code.substring(0, 4),
          month: e.month,
          value: e.value,
        }));
      return buildTopBreakdowns(items, (key) => getExpenseCategory(key));
    }

    const row_details = {
      ventas_brutas: buildTopBreakdowns(ventasItems, (k) => k),
      costo_ventas: buildTopBreakdowns(cogsItems, (k) => k),
      gastos_admin: expenseBreakdown('51'),
      gastos_venta: expenseBreakdown('52'),
      gastos_financieros: expenseBreakdown('53'),
    };

    return NextResponse.json({
      months,
      totals,
      gastos_groups,
      ventas_by_supplier,
      row_details,
      data_counts: {
        invoices: invoices.length,
        credit_notes: creditNotes.length,
        journals: journals.length,
        purchases: purchases.length,
        cogs_items: costoVentas.length,
        expense_items_journal: gastosJournal.length,
        expense_items_purchase: gastosPurchase.length,
        iva_items: ivaDescontableJournal.length + ivaPurchase.length,
        invoice_items: invoiceItems.length,
        products: products.length,
        suppliers_with_sales: ventas_by_supplier.length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function getExpenseCategory(prefix: string): string {
  const map: Record<string, string> = {
    '5105': 'Nomina',
    '5110': 'Honorarios',
    '5115': 'Impuestos',
    '5120': 'Arrendamientos',
    '5125': 'Contribuciones',
    '5130': 'Seguros',
    '5135': 'Servicios',
    '5140': 'Gastos Legales',
    '5145': 'Mantenimiento',
    '5150': 'Adecuaciones',
    '5155': 'Depreciaciones',
    '5160': 'Amortizaciones',
    '5195': 'Diversos',
    '5199': 'Provisiones',
    '5205': 'Personal (Ventas)',
    '5210': 'Honorarios (Ventas)',
    '5215': 'Impuestos (Ventas)',
    '5220': 'Arrendamientos (Ventas)',
    '5235': 'Servicios (Ventas)',
    '5240': 'Gastos Legales (Ventas)',
    '5245': 'Mantenimiento (Ventas)',
    '5295': 'Diversos (Ventas)',
    '5305': 'Gastos Financieros',
    '5310': 'Perdida Cambio',
    '5315': 'Gastos Extraordinarios',
    '5395': 'Otros No Operacionales',
  };
  return map[prefix] || `Otro (${prefix})`;
}
