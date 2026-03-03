import { NextRequest, NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

export const maxDuration = 60;

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function toDateStr(ym: string): string {
  return `${ym}-01`;
}

function nextMonthStart(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

// ── GET /api/dashboard/correccion-costos ──────────────────────────────────────
// Params:
//   start        YYYY-MM  (default 2025-01)
//   end          YYYY-MM  (default current month)
//   month_filter YYYY-MM  (optional — only return product rows for this month)

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const startParam = params.get('start') || '2025-01';
    const endParam   = params.get('end')   || '2026-02';
    const monthFilter = params.get('month_filter') || null;

    const startDate = toDateStr(startParam);
    const endDate   = nextMonthStart(endParam);

    // ── BLOQUE A: Month Overview ───────────────────────────────────────────

    // A1. Invoices (non-annulled) en rango
    const invoices = await fetchAllRows('invoices', 'id, date', (q) =>
      q.eq('annulled', false).gte('date', startDate).lt('date', endDate)
    );
    const invoiceIds = invoices.map(i => i.id as string);
    const invoiceDateMap = new Map(invoices.map(i => [i.id as string, (i.date as string).substring(0, 7)]));

    // A2. Invoice items para calcular revenue por mes
    let allInvItems: Record<string, unknown>[] = [];
    for (let i = 0; i < invoiceIds.length; i += 200) {
      const batch = invoiceIds.slice(i, i + 200);
      const items = await fetchAllRows('invoice_items', 'invoice_id, line_total, tax_value', (q) =>
        q.in('invoice_id', batch)
      );
      allInvItems = allInvItems.concat(items);
    }

    // Revenue por mes
    const revenueByMonth = new Map<string, number>();
    const invoiceCountByMonth = new Map<string, number>();
    const countedInvoices = new Set<string>();
    for (const item of allInvItems) {
      const invId = item.invoice_id as string;
      const month = invoiceDateMap.get(invId);
      if (!month) continue;
      const lineTotal = (item.line_total as number) || 0;
      const taxValue  = (item.tax_value as number) || 0;
      revenueByMonth.set(month, (revenueByMonth.get(month) || 0) + lineTotal - taxValue);
      if (!countedInvoices.has(invId)) {
        countedInvoices.add(invId);
        invoiceCountByMonth.set(month, (invoiceCountByMonth.get(month) || 0) + 1);
      }
    }

    // A3. Journals en rango → journal_items COGS 6135
    const journals = await fetchAllRows('journals', 'id, date', (q) =>
      q.gte('date', startDate).lt('date', endDate)
    );
    const journalIds = journals.map(j => j.id as string);
    const journalDateMap = new Map(journals.map(j => [j.id as string, (j.date as string).substring(0, 7)]));

    let cogsItems: Record<string, unknown>[] = [];
    for (let i = 0; i < journalIds.length; i += 200) {
      const batch = journalIds.slice(i, i + 200);
      const items = await fetchAllRows('journal_items', 'journal_id, value, product_code', (q) =>
        q.in('journal_id', batch).like('account_code', '6135%').eq('movement', 'Debit')
      );
      cogsItems = cogsItems.concat(items);
    }

    const cogsByMonth = new Map<string, number>();
    const cogsByProductMonth = new Map<string, number>();
    for (const item of cogsItems) {
      const jId   = item.journal_id as string;
      const month = journalDateMap.get(jId);
      if (!month) continue;
      const value = (item.value as number) || 0;
      const code  = item.product_code as string;
      cogsByMonth.set(month, (cogsByMonth.get(month) || 0) + value);
      if (code) {
        const key = `${code}::${month}`;
        cogsByProductMonth.set(key, (cogsByProductMonth.get(key) || 0) + value);
      }
    }

    // Build month overview
    const allMonths = new Set<string>();
    revenueByMonth.forEach((_, m) => allMonths.add(m));
    cogsByMonth.forEach((_, m) => allMonths.add(m));
    // Also include months with no data but in range (so UI shows full table)
    let cur = startParam;
    while (cur <= endParam) {
      allMonths.add(cur);
      const [y, m] = cur.split('-').map(Number);
      cur = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    }

    const monthOverview = Array.from(allMonths).sort().map(month => {
      const rev  = revenueByMonth.get(month) || 0;
      const cogs = cogsByMonth.get(month) || 0;
      const pct  = rev > 0 ? (cogs / rev) * 100 : 0;
      let status: 'ok' | 'low' | 'none' | 'empty' = 'empty';
      if (rev > 0) {
        if (pct >= 30) status = 'ok';
        else if (pct >= 5) status = 'low';
        else status = 'none';
      }
      const avgRatio = 0.62; // empirical avg from analysis (Jan-Aug 2025)
      const cogsGap = Math.max(0, rev * avgRatio - cogs);
      return {
        month,
        invoice_count: invoiceCountByMonth.get(month) || 0,
        revenue: Math.round(rev),
        cogs_recorded: Math.round(cogs),
        cogs_pct: Math.round(pct * 10) / 10,
        cogs_gap: Math.round(cogsGap),
        status,
      };
    });

    // ── BLOQUE B: Historical Cost Ratios (Ene–Ago 2025) ───────────────────

    const HIST_START = '2025-01-01';
    const HIST_END   = '2025-09-01';

    const histInvoices = await fetchAllRows('invoices', 'id, date', (q) =>
      q.eq('annulled', false).gte('date', HIST_START).lt('date', HIST_END)
    );
    const histInvIds = histInvoices.map(i => i.id as string);

    let histInvItems: Record<string, unknown>[] = [];
    for (let i = 0; i < histInvIds.length; i += 200) {
      const batch = histInvIds.slice(i, i + 200);
      const items = await fetchAllRows('invoice_items', 'invoice_id, product_code, line_total, tax_value', (q) =>
        q.in('invoice_id', batch)
      );
      histInvItems = histInvItems.concat(items);
    }

    const histRevByProduct = new Map<string, number>();
    for (const item of histInvItems) {
      const code  = item.product_code as string;
      if (!code) continue;
      const lt  = (item.line_total as number) || 0;
      const tax = (item.tax_value as number) || 0;
      histRevByProduct.set(code, (histRevByProduct.get(code) || 0) + lt - tax);
    }

    const histJournals = await fetchAllRows('journals', 'id, date', (q) =>
      q.gte('date', HIST_START).lt('date', HIST_END)
    );
    const histJournalIds = histJournals.map(j => j.id as string);

    let histCogsItems: Record<string, unknown>[] = [];
    for (let i = 0; i < histJournalIds.length; i += 200) {
      const batch = histJournalIds.slice(i, i + 200);
      const items = await fetchAllRows('journal_items', 'journal_id, value, product_code', (q) =>
        q.in('journal_id', batch).like('account_code', '6135%').eq('movement', 'Debit')
      );
      histCogsItems = histCogsItems.concat(items);
    }

    const histCogsByProduct = new Map<string, number>();
    for (const item of histCogsItems) {
      const code  = item.product_code as string;
      if (!code) continue;
      const value = (item.value as number) || 0;
      histCogsByProduct.set(code, (histCogsByProduct.get(code) || 0) + value);
    }

    // Build ratio map: product_code → ratio
    const historicalRatioMap = new Map<string, number>();
    let ratioSum = 0;
    let ratioCount = 0;
    for (const [code, cogs] of histCogsByProduct) {
      const rev = histRevByProduct.get(code);
      if (rev && rev > 0 && cogs > 0) {
        const ratio = cogs / rev;
        if (ratio > 0 && ratio < 2) { // sanity filter
          historicalRatioMap.set(code, ratio);
          ratioSum += ratio;
          ratioCount++;
        }
      }
    }
    const avgRatio = ratioCount > 0 ? ratioSum / ratioCount : 0.62;

    // ── BLOQUE C: Product Rows ─────────────────────────────────────────────

    // Determine which months to include in product rows
    const problemMonths = new Set<string>(
      monthOverview.filter(m => m.status === 'none' || m.status === 'low').map(m => m.month)
    );

    // If month_filter provided, use only that month; else use all problem months
    let productMonthFilter: Set<string>;
    if (monthFilter) {
      productMonthFilter = new Set([monthFilter]);
    } else {
      productMonthFilter = problemMonths;
    }

    // Invoices for the product rows (only problem/filtered months)
    const prodInvoices = invoices.filter(i => {
      const month = (i.date as string).substring(0, 7);
      return productMonthFilter.has(month);
    });
    const prodInvIds = prodInvoices.map(i => i.id as string);

    let prodInvItems: Record<string, unknown>[] = [];
    for (let i = 0; i < prodInvIds.length; i += 200) {
      const batch = prodInvIds.slice(i, i + 200);
      const items = await fetchAllRows(
        'invoice_items',
        'invoice_id, product_code, quantity, line_total, tax_value',
        (q) => q.in('invoice_id', batch)
      );
      prodInvItems = prodInvItems.concat(items);
    }

    // Products catalog
    const products = await fetchAllRows('products', 'code, name, supplier_name, sale_price, account_group_name');
    const productByCode = new Map(products.map(p => [p.code as string, p]));

    // Aggregate sales by product+month
    const salesByProductMonth = new Map<string, { qty: number; revenue: number }>();
    for (const item of prodInvItems) {
      const code  = item.product_code as string;
      const invId = item.invoice_id as string;
      const month = invoiceDateMap.get(invId);
      if (!code || !month) continue;
      const qty     = (item.quantity as number) || 0;
      const lt      = (item.line_total as number) || 0;
      const tax     = (item.tax_value as number) || 0;
      const revenue = lt - tax;
      const key = `${code}::${month}`;
      if (!salesByProductMonth.has(key)) salesByProductMonth.set(key, { qty: 0, revenue: 0 });
      const entry = salesByProductMonth.get(key)!;
      entry.qty += qty;
      entry.revenue += revenue;
    }

    // Build product rows
    interface ProductRow {
      product_code: string;
      product_name: string;
      supplier_name: string;
      sale_price: number;
      sale_month: string;
      quantity_sold: number;
      revenue: number;
      cost_source: 'historical' | 'purchase' | 'journal' | 'none';
      historical_ratio: number | null;
      estimated_cost: number;
      journal_cost: number;
    }

    const productRows: ProductRow[] = [];

    for (const [key, sales] of salesByProductMonth) {
      const [code, saleMonth] = key.split('::');
      const product = productByCode.get(code);
      const supplierName = (product?.supplier_name as string) || '';
      const salePriceWithIva = (product?.sale_price as number) || 0;
      const salePrice = Math.round(salePriceWithIva / 1.19);

      const journalCost = cogsByProductMonth.get(key) || 0;
      const hasJournal  = journalCost > 0;

      const histRatio = historicalRatioMap.get(code) ?? null;

      let costSource: ProductRow['cost_source'];
      let estimatedCost: number;

      if (hasJournal) {
        costSource    = 'journal';
        estimatedCost = sales.qty > 0 ? Math.round(journalCost / sales.qty) : 0;
      } else if (histRatio !== null) {
        costSource    = 'historical';
        estimatedCost = sales.qty > 0 ? Math.round((sales.revenue / sales.qty) * histRatio) : 0;
      } else {
        costSource    = 'none';
        estimatedCost = sales.qty > 0 ? Math.round((sales.revenue / sales.qty) * 0.70) : 0;
      }

      productRows.push({
        product_code: code,
        product_name: (product?.name as string) || code,
        supplier_name: supplierName,
        sale_price: salePrice,
        sale_month: saleMonth,
        quantity_sold: sales.qty,
        revenue: Math.round(sales.revenue),
        cost_source: costSource,
        historical_ratio: histRatio !== null ? Math.round(histRatio * 1000) / 10 : null, // as %
        estimated_cost: estimatedCost,
        journal_cost: Math.round(journalCost),
      });
    }

    // Sort: none first, then historical, then journal; within group by month then revenue desc
    const sourceOrder = { none: 0, historical: 1, purchase: 2, journal: 3 };
    productRows.sort((a, b) => {
      const so = sourceOrder[a.cost_source] - sourceOrder[b.cost_source];
      if (so !== 0) return so;
      if (a.sale_month !== b.sale_month) return a.sale_month.localeCompare(b.sale_month);
      return b.revenue - a.revenue;
    });

    // Summary
    const totalRevenue  = productRows.reduce((s, p) => s + p.revenue, 0);
    const cogsRecorded  = productRows.reduce((s, p) => s + p.journal_cost, 0);
    const cogsEstimated = productRows
      .filter(p => p.cost_source !== 'journal')
      .reduce((s, p) => s + p.estimated_cost * p.quantity_sold, 0);

    return NextResponse.json({
      month_overview: monthOverview,
      historical_stats: {
        good_months: ['2025-01','2025-02','2025-03','2025-04','2025-05','2025-06','2025-07','2025-08'],
        products_with_ratio: historicalRatioMap.size,
        avg_ratio: Math.round(avgRatio * 1000) / 10, // as %
      },
      products: productRows,
      summary: {
        total_revenue: Math.round(totalRevenue),
        cogs_recorded: Math.round(cogsRecorded),
        cogs_estimated_missing: Math.round(cogsEstimated),
        products_with_historical: productRows.filter(p => p.cost_source === 'historical').length,
        products_no_cost: productRows.filter(p => p.cost_source === 'none').length,
        products_with_journal: productRows.filter(p => p.cost_source === 'journal').length,
      },
      active_month_filter: monthFilter,
      problem_months: Array.from(problemMonths).sort(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[/api/dashboard/correccion-costos]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
