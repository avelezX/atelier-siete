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

// Investigate purchase_items account codes over time
export async function GET() {
  try {
    const purchases = await fetchAllRows('purchases', 'id, date, name, supplier_name, total');
    const purchaseItems = await fetchAllRows(
      'purchase_items',
      'purchase_id, account_code, description, quantity, price, tax_value'
    );

    const purchaseMap = new Map<string, { date: string; name: string; supplier: string; total: number }>();
    purchases.forEach((p) => {
      purchaseMap.set(p.id as string, {
        date: (p.date as string) || '',
        name: (p.name as string) || '',
        supplier: (p.supplier_name as string) || '',
        total: Number(p.total) || 0,
      });
    });

    // Group purchase items by account_code prefix (4 digits) and by period (before/after Aug 2025)
    const CUTOFF = '2025-08-01';

    interface AccountStats {
      code: string;
      before_count: number;
      before_value: number;
      after_count: number;
      after_value: number;
      sample_descriptions: string[];
      sample_suppliers: string[];
    }

    const accountMap = new Map<string, AccountStats>();

    purchaseItems.forEach((pi) => {
      const code = (pi.account_code as string) || 'unknown';
      const prefix = code.substring(0, 4);
      const pInfo = purchaseMap.get(pi.purchase_id as string);
      if (!pInfo) return;

      const value = (Number(pi.price) || 0) * (Number(pi.quantity) || 1);
      const isBefore = pInfo.date < CUTOFF;

      if (!accountMap.has(prefix)) {
        accountMap.set(prefix, {
          code: prefix,
          before_count: 0, before_value: 0,
          after_count: 0, after_value: 0,
          sample_descriptions: [],
          sample_suppliers: [],
        });
      }
      const entry = accountMap.get(prefix)!;
      if (isBefore) {
        entry.before_count++;
        entry.before_value += value;
      } else {
        entry.after_count++;
        entry.after_value += value;
      }
      const desc = (pi.description as string) || '';
      if (entry.sample_descriptions.length < 5 && desc && !entry.sample_descriptions.includes(desc.substring(0, 60))) {
        entry.sample_descriptions.push(desc.substring(0, 60));
      }
      if (entry.sample_suppliers.length < 5 && pInfo.supplier && !entry.sample_suppliers.includes(pInfo.supplier)) {
        entry.sample_suppliers.push(pInfo.supplier);
      }
    });

    // Also show monthly purchase totals to see the full picture
    const monthlyTotals = new Map<string, { total: number; count: number; accounts: Map<string, number> }>();
    purchaseItems.forEach((pi) => {
      const pInfo = purchaseMap.get(pi.purchase_id as string);
      if (!pInfo) return;
      const month = pInfo.date.substring(0, 7);
      const value = (Number(pi.price) || 0) * (Number(pi.quantity) || 1);
      const code = ((pi.account_code as string) || 'unknown').substring(0, 4);

      if (!monthlyTotals.has(month)) {
        monthlyTotals.set(month, { total: 0, count: 0, accounts: new Map() });
      }
      const entry = monthlyTotals.get(month)!;
      entry.total += value;
      entry.count++;
      entry.accounts.set(code, (entry.accounts.get(code) || 0) + value);
    });

    // Also check: how many purchases exist per month (headers only)
    const purchasesByMonth = new Map<string, { count: number; total: number }>();
    purchases.forEach((p) => {
      const date = (p.date as string) || '';
      const month = date.substring(0, 7);
      if (!purchasesByMonth.has(month)) purchasesByMonth.set(month, { count: 0, total: 0 });
      const entry = purchasesByMonth.get(month)!;
      entry.count++;
      entry.total += Number(p.total) || 0;
    });

    // PUC account name lookup
    const pucNames: Record<string, string> = {
      '1435': 'Mercancías no fabricadas por empresa',
      '2205': 'Proveedores nacionales',
      '2365': 'Retención en la fuente',
      '2368': 'Impuesto de industria y comercio retenido',
      '2408': 'IVA por pagar',
      '5120': 'Arrendamientos',
      '5135': 'Servicios',
      '5195': 'Diversos (gastos admin)',
      '5305': 'Financieros',
      '6135': 'Costo de mercancía vendida',
      '1105': 'Caja',
      '1110': 'Bancos',
      '1305': 'Clientes',
    };

    return NextResponse.json({
      accounts: Array.from(accountMap.values())
        .sort((a, b) => (b.before_value + b.after_value) - (a.before_value + a.after_value))
        .map((a) => ({
          ...a,
          puc_name: pucNames[a.code] || 'Otro',
          total_value: a.before_value + a.after_value,
        })),
      monthly: Array.from(monthlyTotals.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({
          month,
          total: data.total,
          items: data.count,
          accounts: Object.fromEntries(
            Array.from(data.accounts.entries()).sort(([, a], [, b]) => b - a)
          ),
        })),
      purchase_headers_by_month: Array.from(purchasesByMonth.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({
          month,
          count: data.count,
          total: data.total,
        })),
      total_purchases: purchases.length,
      total_purchase_items: purchaseItems.length,
      date_range: {
        earliest: purchases.length > 0 ? purchases.reduce((min, p) => {
          const d = (p.date as string) || '9999';
          return d < min ? d : min;
        }, '9999') : null,
        latest: purchases.length > 0 ? purchases.reduce((max, p) => {
          const d = (p.date as string) || '';
          return d > max ? d : max;
        }, '') : null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
