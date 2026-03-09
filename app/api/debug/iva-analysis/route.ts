import { NextRequest, NextResponse } from 'next/server';
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

// Diagnostic: Compare IVA descontable from 3 sources
export async function GET(request: NextRequest) {
  const yearParam = request.nextUrl.searchParams.get('year');
  const year = yearParam ? parseInt(yearParam) : 2025;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;

  try {
    // === SOURCE 1: Journal items account 2408 Debit ===
    const journals = await fetchAllRows('journals', 'id, date, name');
    const journalMap = new Map<string, { date: string; name: string }>();
    journals.forEach((j) => {
      journalMap.set(j.id as string, {
        date: (j.date as string) || '',
        name: (j.name as string) || '',
      });
    });

    const journal2408 = await fetchAllRows(
      'journal_items',
      'account_code, movement, value, journal_id, description',
      (q) => q.like('account_code', '2408%').eq('movement', 'Debit')
    );

    // Filter by year
    const journal2408Year = journal2408.filter((item) => {
      const date = journalMap.get(item.journal_id as string)?.date || '';
      return date >= yearStart && date < yearEnd;
    });

    // === SOURCE 2: Purchase HEADERS tax_amount ===
    const purchases = await fetchAllRows(
      'purchases',
      'id, date, name, supplier_name, subtotal, tax_amount, total',
      (q) => q.gte('date', yearStart).lt('date', yearEnd)
    );

    // === SOURCE 3: Purchase ITEMS tax_value ===
    const purchaseItems = await fetchAllRows(
      'purchase_items',
      'purchase_id, account_code, description, quantity, price, tax_name, tax_percentage, tax_value, line_total',
      (q) => q.gt('tax_value', 0)
    );

    // Filter purchase items by year (via purchase date)
    const purchaseIdSet = new Set(purchases.map((p) => p.id as string));
    const purchaseItemsYear = purchaseItems.filter((pi) =>
      purchaseIdSet.has(pi.purchase_id as string)
    );

    // === ANALYSIS ===

    // Group journal 2408 by month with document detail
    interface DocDetail {
      name: string;
      date: string;
      value: number;
      description: string;
      account_code: string;
      supplier_name?: string;
    }

    const journal2408ByMonth = new Map<string, { total: number; docs: DocDetail[] }>();
    journal2408Year.forEach((item) => {
      const info = journalMap.get(item.journal_id as string);
      if (!info) return;
      const month = info.date.substring(0, 7);
      const value = Number(item.value) || 0;
      if (!journal2408ByMonth.has(month)) {
        journal2408ByMonth.set(month, { total: 0, docs: [] });
      }
      const entry = journal2408ByMonth.get(month)!;
      entry.total += value;
      entry.docs.push({
        name: info.name,
        date: info.date,
        value,
        description: (item.description as string) || '',
        account_code: (item.account_code as string) || '',
      });
    });

    // Group purchase headers by month with detail
    const purchaseHeaderByMonth = new Map<string, { total: number; docs: DocDetail[] }>();
    purchases.forEach((p) => {
      const date = (p.date as string) || '';
      const month = date.substring(0, 7);
      const taxAmt = Number(p.tax_amount) || 0;
      if (taxAmt <= 0) return;
      if (!purchaseHeaderByMonth.has(month)) {
        purchaseHeaderByMonth.set(month, { total: 0, docs: [] });
      }
      const entry = purchaseHeaderByMonth.get(month)!;
      entry.total += taxAmt;
      entry.docs.push({
        name: (p.name as string) || '',
        date,
        value: taxAmt,
        description: `Subtotal: ${Number(p.subtotal).toLocaleString()} | Total: ${Number(p.total).toLocaleString()}`,
        account_code: '',
        supplier_name: (p.supplier_name as string) || '',
      });
    });

    // Group purchase items by month (sum tax_value per purchase)
    const purchaseItemByMonth = new Map<string, { total: number; docs: DocDetail[] }>();
    // First group items by purchase_id
    const itemsByPurchase = new Map<string, { tax_total: number; items: typeof purchaseItemsYear }>();
    purchaseItemsYear.forEach((pi) => {
      const pid = pi.purchase_id as string;
      if (!itemsByPurchase.has(pid)) {
        itemsByPurchase.set(pid, { tax_total: 0, items: [] });
      }
      const entry = itemsByPurchase.get(pid)!;
      entry.tax_total += Number(pi.tax_value) || 0;
      entry.items.push(pi);
    });

    // Map to months
    purchases.forEach((p) => {
      const pid = p.id as string;
      const date = (p.date as string) || '';
      const month = date.substring(0, 7);
      const itemData = itemsByPurchase.get(pid);
      if (!itemData || itemData.tax_total <= 0) return;
      if (!purchaseItemByMonth.has(month)) {
        purchaseItemByMonth.set(month, { total: 0, docs: [] });
      }
      const entry = purchaseItemByMonth.get(month)!;
      entry.total += itemData.tax_total;
      entry.docs.push({
        name: (p.name as string) || '',
        date,
        value: itemData.tax_total,
        description: `${itemData.items.length} items con IVA`,
        account_code: itemData.items.map((i) => i.account_code).join(', '),
        supplier_name: (p.supplier_name as string) || '',
      });
    });

    // === Build month-by-month comparison ===
    const allMonths = new Set<string>();
    journal2408ByMonth.forEach((_, m) => allMonths.add(m));
    purchaseHeaderByMonth.forEach((_, m) => allMonths.add(m));
    purchaseItemByMonth.forEach((_, m) => allMonths.add(m));

    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];

    const comparison = Array.from(allMonths).sort().map((month) => {
      const j = journal2408ByMonth.get(month);
      const ph = purchaseHeaderByMonth.get(month);
      const pi = purchaseItemByMonth.get(month);

      return {
        month,
        month_label: monthNames[parseInt(month.split('-')[1]) - 1],
        journals_2408: {
          total: j?.total || 0,
          count: j?.docs.length || 0,
          documents: j?.docs.sort((a, b) => b.value - a.value) || [],
        },
        purchase_headers: {
          total: ph?.total || 0,
          count: ph?.docs.length || 0,
          documents: ph?.docs.sort((a, b) => b.value - a.value) || [],
        },
        purchase_items: {
          total: pi?.total || 0,
          count: pi?.docs.length || 0,
          documents: pi?.docs.sort((a, b) => b.value - a.value) || [],
        },
        // Key comparisons
        header_vs_items_diff: (ph?.total || 0) - (pi?.total || 0),
        journals_vs_headers_diff: (j?.total || 0) - (ph?.total || 0),
      };
    });

    // === Try to match journal 2408 entries to purchases ===
    // Match by date + similar value to detect overlaps
    interface MatchResult {
      journal_name: string;
      journal_date: string;
      journal_value: number;
      matched_purchase: string | null;
      matched_supplier: string | null;
      matched_value: number | null;
      match_type: 'exact_value' | 'same_date' | 'no_match';
    }

    const matchResults: MatchResult[] = [];
    journal2408Year.forEach((item) => {
      const info = journalMap.get(item.journal_id as string);
      if (!info) return;
      const value = Number(item.value) || 0;
      const date = info.date;

      // Try to find a purchase on the same date with matching tax_amount
      const sameDatePurchases = purchases.filter(
        (p) => (p.date as string) === date && Math.abs(Number(p.tax_amount) - value) < 1
      );

      if (sameDatePurchases.length > 0) {
        matchResults.push({
          journal_name: info.name,
          journal_date: date,
          journal_value: value,
          matched_purchase: (sameDatePurchases[0].name as string) || null,
          matched_supplier: (sameDatePurchases[0].supplier_name as string) || null,
          matched_value: Number(sameDatePurchases[0].tax_amount) || null,
          match_type: 'exact_value',
        });
      } else {
        const sameDateAny = purchases.filter((p) => (p.date as string) === date);
        if (sameDateAny.length > 0) {
          matchResults.push({
            journal_name: info.name,
            journal_date: date,
            journal_value: value,
            matched_purchase: sameDateAny.map((p) => p.name).join(', '),
            matched_supplier: sameDateAny.map((p) => p.supplier_name).join(', '),
            matched_value: sameDateAny.reduce((s, p) => s + (Number(p.tax_amount) || 0), 0),
            match_type: 'same_date',
          });
        } else {
          matchResults.push({
            journal_name: info.name,
            journal_date: date,
            journal_value: value,
            matched_purchase: null,
            matched_supplier: null,
            matched_value: null,
            match_type: 'no_match',
          });
        }
      }
    });

    // === Totals ===
    const totals = {
      journals_2408: comparison.reduce((s, m) => s + m.journals_2408.total, 0),
      purchase_headers: comparison.reduce((s, m) => s + m.purchase_headers.total, 0),
      purchase_items: comparison.reduce((s, m) => s + m.purchase_items.total, 0),
    };

    // === Unique document names in journals that are NOT in purchases ===
    const journalNames = new Set(journal2408Year.map((j) => journalMap.get(j.journal_id as string)?.name).filter(Boolean));
    const purchaseNames = new Set(purchases.map((p) => p.name as string));
    const journalOnlyNames = Array.from(journalNames).filter((n) => !purchaseNames.has(n!));
    const purchaseOnlyNames = Array.from(purchaseNames).filter((n) => !journalNames.has(n));

    // Check if journal CC names overlap with purchase FC names (different prefixes)
    const journalPrefixes = new Set(Array.from(journalNames).map((n) => n?.split('-')[0]));
    const purchasePrefixes = new Set(Array.from(purchaseNames).map((n) => n?.split('-')[0]));

    return NextResponse.json({
      year,
      totals,
      resumen_actual: {
        usa: 'journals_2408 + purchase_items (SUMADOS)',
        total: totals.journals_2408 + totals.purchase_items,
        nota: 'Puede tener doble conteo si un FC genera tanto purchase como journal 2408',
      },
      tab_iva: {
        usa: 'purchase_headers.tax_amount',
        total: totals.purchase_headers,
        nota: 'No incluye IVA de comprobantes contables (CC) que no tengan factura de compra',
      },
      header_vs_items: {
        diff: totals.purchase_headers - totals.purchase_items,
        nota: 'Si es ~0, purchase headers y items son consistentes',
      },
      document_prefixes: {
        journals: Array.from(journalPrefixes),
        purchases: Array.from(purchasePrefixes),
        nota: 'CC = Comprobante Contable, FC = Factura de Compra. Prefijos distintos = documentos distintos',
      },
      journal_only_documents: journalOnlyNames.slice(0, 30),
      purchase_only_documents: purchaseOnlyNames.slice(0, 30),
      match_analysis: {
        total_journal_entries: matchResults.length,
        exact_value_matches: matchResults.filter((m) => m.match_type === 'exact_value').length,
        same_date_matches: matchResults.filter((m) => m.match_type === 'same_date').length,
        no_matches: matchResults.filter((m) => m.match_type === 'no_match').length,
        details: matchResults,
      },
      monthly_comparison: comparison,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
