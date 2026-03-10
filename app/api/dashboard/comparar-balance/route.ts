import { NextRequest, NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';
import { fetchTestBalanceReport } from '@/lib/siigo';
import * as XLSX from 'xlsx';

export const maxDuration = 120;

// Paginated fetch helper
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

// Parse a Siigo Balance de Prueba Excel from a URL
interface BalanceAccount {
  code: string;
  account_name: string;
  nivel: string;  // Clase, Grupo, Cuenta, Subcuenta, Auxiliar
  initial_balance: number;
  mov_debit: number;
  mov_credit: number;
  final_balance: number;
}

async function parseBalanceExcel(fileUrl: string): Promise<BalanceAccount[]> {
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) throw new Error(`Failed to download: ${fileRes.status}`);
  const buffer = await fileRes.arrayBuffer();

  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const allRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  // Find header row and detect column layout
  // Siigo format: Nivel | Transaccional | Código cuenta contable | Nombre | Saldo Inicial | Mov Débito | Mov Crédito | Saldo Final
  let headerRowIdx = -1;
  let nivelColIdx = -1;  // "Nivel" column (Clase, Grupo, Cuenta, Subcuenta, Auxiliar)
  let codeColIdx = 0;
  let nameColIdx = 1;
  let numsStartIdx = 2;

  for (let i = 0; i < Math.min(allRows.length, 10); i++) {
    const row = allRows[i] || [];

    // Scan each cell for the code column header
    for (let col = 0; col < row.length; col++) {
      const cell = String(row[col] || '').toLowerCase();
      if (cell.includes('código cuenta') || cell.includes('codigo cuenta') || cell === 'código' || cell === 'codigo') {
        headerRowIdx = i;
        codeColIdx = col;
        nameColIdx = col + 1;
        numsStartIdx = col + 2;
        break;
      }
    }

    // Fallback: check for "Nivel" in first cell (Siigo format)
    if (headerRowIdx < 0) {
      const firstCell = String(row[0] || '').toLowerCase();
      if (firstCell === 'nivel') {
        headerRowIdx = i;
        nivelColIdx = 0;
        codeColIdx = 2;
        nameColIdx = 3;
        numsStartIdx = 4;
      }
    }

    // Also detect Nivel column from header row
    if (headerRowIdx === i) {
      for (let col = 0; col < row.length; col++) {
        if (String(row[col] || '').toLowerCase() === 'nivel') {
          nivelColIdx = col;
          break;
        }
      }
    }

    if (headerRowIdx >= 0) break;
  }

  const accounts: BalanceAccount[] = [];
  const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;

  for (let i = startRow; i < allRows.length; i++) {
    const row = allRows[i] || [];
    const code = String(row[codeColIdx] || '').trim();
    if (!code || !/^\d{1,8}$/.test(code)) continue;

    const nivel = nivelColIdx >= 0 ? String(row[nivelColIdx] || '').trim() : '';
    const name = String(row[nameColIdx] || '').trim();
    const nums = row.slice(numsStartIdx).map((v) => {
      const n = Number(v);
      return isNaN(n) ? 0 : n;
    });

    // Siigo: Saldo Inicial | Mov Débito | Mov Crédito | Saldo Final
    accounts.push({
      code,
      account_name: name,
      nivel,
      initial_balance: nums[0] || 0,
      mov_debit: nums[1] || 0,
      mov_credit: nums[2] || 0,
      final_balance: nums[3] || 0,
    });
  }

  return accounts;
}

// Aggregate balance accounts by prefix — only leaf accounts (no children) to avoid double counting
function aggregateByPrefix(accounts: BalanceAccount[], prefix: string): { mov_debit: number; mov_credit: number; net: number } {
  // Collect all codes that match the prefix
  const matching = accounts.filter(a => a.code.startsWith(prefix));

  // Build set of all codes for parent detection
  const allCodes = new Set(matching.map(a => a.code));

  let movDebit = 0;
  let movCredit = 0;

  for (const acc of matching) {
    // An account is a leaf if no other account has it as a prefix
    const isLeaf = !matching.some(other => other.code !== acc.code && other.code.startsWith(acc.code));
    if (isLeaf) {
      movDebit += acc.mov_debit;
      movCredit += acc.mov_credit;
    }
  }

  return { mov_debit: movDebit, mov_credit: movCredit, net: movDebit - movCredit };
}

// GET /api/dashboard/comparar-balance?year=2025
export async function GET(req: NextRequest) {
  try {
    const year = parseInt(req.nextUrl.searchParams.get('year') || '2025');

    // === PART A: Fetch Balance de Prueba from Siigo (monthly) ===
    // Fetch each month individually to get monthly movements
    const balanceByMonth: Record<string, BalanceAccount[]> = {};
    const siigoErrors: string[] = [];

    // Fetch months SEQUENTIALLY — Siigo caches reports and returns stale data
    // when called in parallel. A small delay between calls prevents cache collisions.
    for (let m = 1; m <= 12; m++) {
      try {
        const report = await fetchTestBalanceReport(year, m, m);
        if (report.file_url) {
          const accounts = await parseBalanceExcel(report.file_url);
          balanceByMonth[`${year}-${String(m).padStart(2, '0')}`] = accounts;
        } else {
          siigoErrors.push(`Month ${m}: no file_url`);
        }
      } catch (e: unknown) {
        siigoErrors.push(`Month ${m}: ${e instanceof Error ? e.message : String(e)}`);
      }
      // Small delay to avoid Siigo cache collisions
      if (m < 12) await new Promise(r => setTimeout(r, 500));
    }

    // === PART B: Fetch our DB data (same as Resumen API) ===

    // Journals + journal_items for COGS and expenses
    const journals = await fetchAllRows('journals', 'id, date, name');
    const journalDateMap = new Map<string, string>();
    journals.forEach((j) => {
      journalDateMap.set(j.id as string, (j.date as string) || '');
    });

    // COGS: journal_items 6135% Debit
    const costoVentas = await fetchAllRows(
      'journal_items',
      'account_code, movement, value, journal_id',
      (q) => q.like('account_code', '6135%').eq('movement', 'Debit')
    );

    // Expenses: journal_items 5% Debit
    const gastosJournal = await fetchAllRows(
      'journal_items',
      'account_code, movement, value, journal_id',
      (q) => q.like('account_code', '5%').eq('movement', 'Debit')
    );

    // Revenue: journal_items 41% Credit (to cross-check against invoices)
    const revenueJournal = await fetchAllRows(
      'journal_items',
      'account_code, movement, value, journal_id',
      (q) => q.like('account_code', '41%').eq('movement', 'Credit')
    );

    // Purchase items: expenses 5% AND COGS 6135%
    const gastosPurchase = await fetchAllRows(
      'purchase_items',
      'account_code, price, quantity, purchase_id',
      (q) => q.like('account_code', '5%')
    );

    // Purchase items: COGS from purchases (account 6135%)
    const cogsPurchase = await fetchAllRows(
      'purchase_items',
      'account_code, price, quantity, purchase_id',
      (q) => q.like('account_code', '6135%')
    );

    // Vouchers (recibos de caja) — missing source of expenses!
    const vouchers = await fetchAllRows('vouchers', 'id, date');
    const voucherDateMap = new Map<string, string>();
    vouchers.forEach((v) => {
      voucherDateMap.set(v.id as string, (v.date as string) || '');
    });

    // Voucher items: get ALL to diagnose what accounts exist
    const allVoucherItems = await fetchAllRows(
      'voucher_items',
      'account_code, movement, value, voucher_id'
    );

    // Diagnose account codes in voucher items
    const voucherAccountCodes = new Map<string, number>();
    allVoucherItems.forEach(item => {
      const code2 = ((item.account_code as string) || '').substring(0, 2);
      voucherAccountCodes.set(code2, (voucherAccountCodes.get(code2) || 0) + 1);
    });

    // Filter for expenses and COGS
    const voucherExpenses = allVoucherItems.filter(item => {
      const code = (item.account_code as string) || '';
      return code.startsWith('5') && (item.movement as string) === 'Debit';
    });
    const voucherCogs = allVoucherItems.filter(item => {
      const code = (item.account_code as string) || '';
      return code.startsWith('6') && (item.movement as string) === 'Debit';
    });

    // Purchase headers for dates
    const purchases = await fetchAllRows('purchases', 'id, date');
    const purchaseDateMap = new Map<string, string>();
    purchases.forEach((p) => {
      purchaseDateMap.set(p.id as string, (p.date as string) || '');
    });

    // Invoices for revenue
    const invoices = await fetchAllRows(
      'invoices',
      'id, date, subtotal, tax_amount',
      (q) => q.eq('annulled', false)
    );

    // Credit notes
    const creditNotes = await fetchAllRows('credit_notes', 'date, total, tax_amount');

    // === PART C: Aggregate our DB data by month ===
    interface OurMonth {
      ventas_brutas: number;        // from invoice subtotals (sin IVA)
      ventas_journal_41: number;    // from journal_items 41% Credit (should match Siigo BP)
      notas_credito: number;
      costo_ventas_cc: number;      // COGS from journals only
      costo_ventas_fc: number;      // COGS from purchase items
      costo_ventas: number;         // total COGS (cc + fc)
      gastos_admin: number;         // 51xx
      gastos_venta: number;         // 52xx
      gastos_financieros: number;   // 53xx
      subcats: Record<string, number>;
    }

    const ourByMonth = new Map<string, OurMonth>();

    function ensureMonth(month: string): OurMonth {
      if (!ourByMonth.has(month)) {
        ourByMonth.set(month, {
          ventas_brutas: 0, ventas_journal_41: 0, notas_credito: 0,
          costo_ventas_cc: 0, costo_ventas_fc: 0, costo_ventas: 0,
          gastos_admin: 0, gastos_venta: 0, gastos_financieros: 0,
          subcats: {},
        });
      }
      return ourByMonth.get(month)!;
    }

    // Revenue (sin IVA)
    invoices.forEach((inv) => {
      const month = (inv.date as string)?.substring(0, 7);
      if (!month) return;
      ensureMonth(month).ventas_brutas += Number(inv.subtotal) || 0;
    });

    // Credit notes (sin IVA)
    creditNotes.forEach((cn) => {
      const month = (cn.date as string)?.substring(0, 7);
      if (!month) return;
      const total = Number(cn.total) || 0;
      const tax = Number(cn.tax_amount) || 0;
      ensureMonth(month).notas_credito += (total - tax);
    });

    // Revenue from journal entries (41% Credit) — cross-check
    revenueJournal.forEach((item) => {
      const date = journalDateMap.get(item.journal_id as string);
      const month = date?.substring(0, 7);
      if (!month) return;
      ensureMonth(month).ventas_journal_41 += Number(item.value) || 0;
    });

    // COGS from journals (CC)
    costoVentas.forEach((item) => {
      const date = journalDateMap.get(item.journal_id as string);
      const month = date?.substring(0, 7);
      if (!month) return;
      const value = Number(item.value) || 0;
      const m = ensureMonth(month);
      m.costo_ventas_cc += value;
      m.costo_ventas += value;
      const prefix4 = (item.account_code as string).substring(0, 4);
      m.subcats[prefix4] = (m.subcats[prefix4] || 0) + value;
    });

    // Expenses from journals (CC)
    gastosJournal.forEach((item) => {
      const date = journalDateMap.get(item.journal_id as string);
      const month = date?.substring(0, 7);
      if (!month) return;
      const value = Number(item.value) || 0;
      const code = item.account_code as string;
      const m = ensureMonth(month);

      if (code.startsWith('51')) m.gastos_admin += value;
      else if (code.startsWith('52')) m.gastos_venta += value;
      else if (code.startsWith('53')) m.gastos_financieros += value;

      const prefix4 = code.substring(0, 4);
      m.subcats[prefix4] = (m.subcats[prefix4] || 0) + value;
    });

    // Expenses from purchases (FC) — sin IVA (price * qty)
    gastosPurchase.forEach((item) => {
      const date = purchaseDateMap.get(item.purchase_id as string);
      const month = date?.substring(0, 7);
      if (!month) return;
      const qty = Number(item.quantity) || 1;
      const value = (Number(item.price) || 0) * qty;
      const code = item.account_code as string;
      const m = ensureMonth(month);

      if (code.startsWith('51')) m.gastos_admin += value;
      else if (code.startsWith('52')) m.gastos_venta += value;
      else if (code.startsWith('53')) m.gastos_financieros += value;

      const prefix4 = code.substring(0, 4);
      m.subcats[prefix4] = (m.subcats[prefix4] || 0) + value;
    });

    // COGS from purchases (FC) — account 6135%
    cogsPurchase.forEach((item) => {
      const date = purchaseDateMap.get(item.purchase_id as string);
      const month = date?.substring(0, 7);
      if (!month) return;
      const qty = Number(item.quantity) || 1;
      const value = (Number(item.price) || 0) * qty;
      const m = ensureMonth(month);
      m.costo_ventas_fc += value;
      m.costo_ventas += value;

      const prefix4 = (item.account_code as string).substring(0, 4);
      m.subcats[prefix4] = (m.subcats[prefix4] || 0) + value;
    });

    // Expenses from vouchers (RC — recibos de caja)
    voucherExpenses.forEach((item) => {
      const date = voucherDateMap.get(item.voucher_id as string);
      const month = date?.substring(0, 7);
      if (!month) return;
      const value = Number(item.value) || 0;
      const code = item.account_code as string;
      const m = ensureMonth(month);

      if (code.startsWith('51')) m.gastos_admin += value;
      else if (code.startsWith('52')) m.gastos_venta += value;
      else if (code.startsWith('53')) m.gastos_financieros += value;

      const prefix4 = code.substring(0, 4);
      m.subcats[prefix4] = (m.subcats[prefix4] || 0) + value;
    });

    // COGS from vouchers (RC)
    voucherCogs.forEach((item) => {
      const date = voucherDateMap.get(item.voucher_id as string);
      const month = date?.substring(0, 7);
      if (!month) return;
      const value = Number(item.value) || 0;
      const m = ensureMonth(month);
      m.costo_ventas += value;

      const prefix4 = (item.account_code as string).substring(0, 4);
      m.subcats[prefix4] = (m.subcats[prefix4] || 0) + value;
    });

    // === PART D: Build comparison ===
    const months = [];
    for (let m = 1; m <= 12; m++) {
      const monthKey = `${year}-${String(m).padStart(2, '0')}`;
      const balanceAccounts = balanceByMonth[monthKey] || [];
      const ours = ourByMonth.get(monthKey);

      // Siigo Balance de Prueba aggregates
      const bp51 = aggregateByPrefix(balanceAccounts, '51');
      const bp52 = aggregateByPrefix(balanceAccounts, '52');
      const bp53 = aggregateByPrefix(balanceAccounts, '53');
      const bp6135 = aggregateByPrefix(balanceAccounts, '6135');
      const bp41 = aggregateByPrefix(balanceAccounts, '41');
      const bp42 = aggregateByPrefix(balanceAccounts, '42');

      // Our aggregates
      const ourAdmin = ours?.gastos_admin || 0;
      const ourVenta = ours?.gastos_venta || 0;
      const ourFinancieros = ours?.gastos_financieros || 0;
      const ourCogs = ours?.costo_ventas || 0;
      const ourCogsCC = ours?.costo_ventas_cc || 0;
      const ourCogsFC = ours?.costo_ventas_fc || 0;
      const ourVentas = ours?.ventas_brutas || 0;
      const ourVentasJournal = ours?.ventas_journal_41 || 0;
      const ourNC = ours?.notas_credito || 0;

      // Subcategory detail for expense accounts
      const subcatDetail: Record<string, { siigo: number; ours: number; diff: number }> = {};

      // Collect all 4-digit prefixes from both sources
      const allPrefixes = new Set<string>();
      for (const acc of balanceAccounts) {
        if (acc.code.length >= 4 && (acc.code.startsWith('5') || acc.code.startsWith('6'))) {
          allPrefixes.add(acc.code.substring(0, 4));
        }
      }
      if (ours?.subcats) {
        Object.keys(ours.subcats).forEach(p => allPrefixes.add(p));
      }

      for (const prefix of allPrefixes) {
        const siigoAgg = aggregateByPrefix(balanceAccounts, prefix);
        const ourVal = ours?.subcats[prefix] || 0;
        // For expense/cost accounts (5x, 6x), the "amount" is typically mov_debit
        const siigoVal = siigoAgg.mov_debit;
        if (siigoVal > 0 || ourVal > 0) {
          subcatDetail[prefix] = {
            siigo: Math.round(siigoVal),
            ours: Math.round(ourVal),
            diff: Math.round(ourVal - siigoVal),
          };
        }
      }

      months.push({
        month: monthKey,
        has_balance: balanceAccounts.length > 0,
        accounts_parsed: balanceAccounts.length,
        comparison: {
          ingresos_41: {
            siigo_credit: Math.round(bp41.mov_credit),
            ours_invoices: Math.round(ourVentas),
            ours_journal_41: Math.round(ourVentasJournal),
            diff_vs_invoices: Math.round(ourVentas - bp41.mov_credit),
            diff_vs_journals: Math.round(ourVentasJournal - bp41.mov_credit),
          },
          gastos_admin_51: {
            siigo_debit: Math.round(bp51.mov_debit),
            ours: Math.round(ourAdmin),
            diff: Math.round(ourAdmin - bp51.mov_debit),
          },
          gastos_venta_52: {
            siigo_debit: Math.round(bp52.mov_debit),
            ours: Math.round(ourVenta),
            diff: Math.round(ourVenta - bp52.mov_debit),
          },
          gastos_financieros_53: {
            siigo_debit: Math.round(bp53.mov_debit),
            ours: Math.round(ourFinancieros),
            diff: Math.round(ourFinancieros - bp53.mov_debit),
          },
          costo_ventas_6135: {
            siigo_debit: Math.round(bp6135.mov_debit),
            ours_total: Math.round(ourCogs),
            ours_cc: Math.round(ourCogsCC),
            ours_fc: Math.round(ourCogsFC),
            diff: Math.round(ourCogs - bp6135.mov_debit),
          },
        },
        subcategory_detail: subcatDetail,
      });
    }

    // Annual totals
    const annualSiigo = { admin_51: 0, venta_52: 0, financieros_53: 0, cogs_6135: 0, ingresos_41: 0 };
    const annualOurs = { admin_51: 0, venta_52: 0, financieros_53: 0, cogs_6135: 0, ingresos_41: 0 };

    months.forEach((m) => {
      annualSiigo.admin_51 += m.comparison.gastos_admin_51.siigo_debit;
      annualSiigo.venta_52 += m.comparison.gastos_venta_52.siigo_debit;
      annualSiigo.financieros_53 += m.comparison.gastos_financieros_53.siigo_debit;
      annualSiigo.cogs_6135 += m.comparison.costo_ventas_6135.siigo_debit;
      annualSiigo.ingresos_41 += m.comparison.ingresos_41.siigo_credit;

      annualOurs.admin_51 += m.comparison.gastos_admin_51.ours;
      annualOurs.venta_52 += m.comparison.gastos_venta_52.ours;
      annualOurs.financieros_53 += m.comparison.gastos_financieros_53.ours;
      annualOurs.cogs_6135 += m.comparison.costo_ventas_6135.ours_total;
      annualOurs.ingresos_41 += m.comparison.ingresos_41.ours_invoices;
    });

    return NextResponse.json({
      year,
      siigo_errors: siigoErrors,
      months_with_data: Object.keys(balanceByMonth).length,
      data_counts: {
        journals: journals.length,
        journal_cogs: costoVentas.length,
        journal_expenses: gastosJournal.length,
        journal_revenue_41: revenueJournal.length,
        purchases: purchases.length,
        purchase_expenses: gastosPurchase.length,
        purchase_cogs: cogsPurchase.length,
        vouchers: vouchers.length,
        voucher_items_total: allVoucherItems.length,
        voucher_expenses: voucherExpenses.length,
        voucher_cogs: voucherCogs.length,
        voucher_account_codes: Object.fromEntries(voucherAccountCodes),
        invoices: invoices.length,
        credit_notes: creditNotes.length,
      },
      months,
      annual_totals: {
        siigo: annualSiigo,
        ours: annualOurs,
        diff: {
          admin_51: Math.round(annualOurs.admin_51 - annualSiigo.admin_51),
          venta_52: Math.round(annualOurs.venta_52 - annualSiigo.venta_52),
          financieros_53: Math.round(annualOurs.financieros_53 - annualSiigo.financieros_53),
          cogs_6135: Math.round(annualOurs.cogs_6135 - annualSiigo.cogs_6135),
          ingresos_41: Math.round(annualOurs.ingresos_41 - annualSiigo.ingresos_41),
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
