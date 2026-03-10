import { NextResponse } from 'next/server';
import { fetchTestBalanceReport } from '@/lib/siigo';
import { atelierTableAdmin } from '@/lib/supabase';
import * as XLSX from 'xlsx';

export const maxDuration = 120;

interface BPAccount {
  code: string;
  name: string;
  saldo_inicial: number;
  mov_debit: number;
  mov_credit: number;
  saldo_final: number;
}

async function parseBalanceExcel(fileUrl: string): Promise<BPAccount[]> {
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) throw new Error(`Download failed: ${fileRes.status}`);
  const buffer = await fileRes.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const allRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  let headerRowIdx = -1, codeColIdx = 0, nameColIdx = 1, numsStartIdx = 2;
  for (let i = 0; i < Math.min(allRows.length, 10); i++) {
    const row = allRows[i] || [];
    for (let col = 0; col < row.length; col++) {
      const cell = String(row[col] || '').toLowerCase();
      if (cell.includes('código cuenta') || cell.includes('codigo cuenta') || cell === 'código' || cell === 'codigo') {
        headerRowIdx = i; codeColIdx = col; nameColIdx = col + 1; numsStartIdx = col + 2; break;
      }
    }
    if (headerRowIdx < 0) {
      const firstCell = String(row[0] || '').toLowerCase();
      if (firstCell === 'nivel') { headerRowIdx = i; codeColIdx = 2; nameColIdx = 3; numsStartIdx = 4; }
    }
    if (headerRowIdx >= 0) break;
  }

  const accounts: BPAccount[] = [];
  for (let i = (headerRowIdx >= 0 ? headerRowIdx + 1 : 0); i < allRows.length; i++) {
    const row = allRows[i] || [];
    const code = String(row[codeColIdx] || '').trim();
    if (!code || !/^\d{1,8}$/.test(code)) continue;
    const nums = row.slice(numsStartIdx).map((v) => { const n = Number(v); return isNaN(n) ? 0 : n; });
    accounts.push({
      code, name: String(row[nameColIdx] || '').trim(),
      saldo_inicial: nums[0] || 0, mov_debit: nums[1] || 0, mov_credit: nums[2] || 0, saldo_final: nums[3] || 0,
    });
  }
  return accounts;
}

async function fetchAllRows(
  table: string, select: string,
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

export async function GET() {
  try {
    const YEAR = 2025;
    const CAJA = '11050501';

    // 1) Monthly BP for Caja
    const cajaMonthly: {
      month: string; saldo_inicial: number; mov_debit: number;
      mov_credit: number; saldo_final: number; net: number;
    }[] = [];

    for (let m = 1; m <= 12; m++) {
      try {
        const report = await fetchTestBalanceReport(YEAR, m, m);
        if (report.file_url) {
          const accounts = await parseBalanceExcel(report.file_url);
          const acc = accounts.find(a => a.code === CAJA);
          if (acc) {
            cajaMonthly.push({
              month: `${YEAR}-${String(m).padStart(2, '0')}`,
              saldo_inicial: Math.round(acc.saldo_inicial),
              mov_debit: Math.round(acc.mov_debit),
              mov_credit: Math.round(acc.mov_credit),
              saldo_final: Math.round(acc.saldo_final),
              net: Math.round(acc.mov_debit - acc.mov_credit),
            });
          }
        }
      } catch { /* skip */ }
      if (m < 12) await new Promise(r => setTimeout(r, 500));
    }

    // 2) CC journal items touching caja
    const journalItemsCaja = await fetchAllRows(
      'journal_items', 'account_code, movement, value, journal_id, description',
      (q) => q.like('account_code', '1105%')
    );
    const cajaJournalIds = [...new Set(journalItemsCaja.map(i => i.journal_id as string))];
    const cajaJournals = cajaJournalIds.length > 0
      ? await fetchAllRows('journals', 'id, date, name', (q) => q.in('id', cajaJournalIds))
      : [];
    const yearCajaJournals = cajaJournals.filter(j => (j.date as string)?.startsWith(String(YEAR)));
    const cajaJournalMap = new Map(yearCajaJournals.map(j => [j.id as string, j]));

    // 3) RC voucher items touching caja
    const voucherItemsCaja = await fetchAllRows(
      'voucher_items', 'account_code, movement, value, voucher_id, description',
      (q) => q.like('account_code', '1105%')
    ).catch(() => [] as Record<string, unknown>[]);

    const cajaVoucherIds = [...new Set(voucherItemsCaja.map(i => i.voucher_id as string))];
    const cajaVouchers = cajaVoucherIds.length > 0
      ? await fetchAllRows('vouchers', 'id, date, name, type', (q) => q.in('id', cajaVoucherIds))
      : [];
    const yearCajaVouchers = cajaVouchers.filter(v => (v.date as string)?.startsWith(String(YEAR)));
    const cajaVoucherMap = new Map(yearCajaVouchers.map(v => [v.id as string, v]));

    // 4) Also check invoice_items and purchase_items touching caja
    const invoiceItemsCaja = await fetchAllRows(
      'invoice_items', 'account_code, price, quantity, invoice_id, description',
      (q) => q.like('account_code', '1105%')
    ).catch(() => [] as Record<string, unknown>[]);

    const purchaseItemsCaja = await fetchAllRows(
      'purchase_items', 'account_code, price, quantity, purchase_id, description',
      (q) => q.like('account_code', '1105%')
    ).catch(() => [] as Record<string, unknown>[]);

    // Build unified list of ALL DB entries touching caja
    interface CajaEntry { date: string; doc: string; type: string; movement: string; value: number; description: string }
    const allCajaEntries: CajaEntry[] = [];

    // From CCs
    for (const i of journalItemsCaja) {
      const j = cajaJournalMap.get(i.journal_id as string);
      if (!j) continue;
      allCajaEntries.push({
        date: j.date as string, doc: j.name as string, type: 'CC',
        movement: i.movement as string, value: Math.round(Number(i.value) || 0),
        description: (i.description as string) || '',
      });
    }

    // From RCs (vouchers)
    for (const i of voucherItemsCaja) {
      const v = cajaVoucherMap.get(i.voucher_id as string);
      if (!v) continue;
      allCajaEntries.push({
        date: v.date as string, doc: v.name as string, type: (v.type as string) || 'RC',
        movement: i.movement as string, value: Math.round(Number(i.value) || 0),
        description: (i.description as string) || '',
      });
    }

    allCajaEntries.sort((a, b) => a.date.localeCompare(b.date));

    // 5) Monthly comparison: BP vs ALL DB sources
    const dbCajaByMonth = new Map<string, {
      cc_debit: number; cc_credit: number; cc_count: number;
      rc_debit: number; rc_credit: number; rc_count: number;
      total_debit: number; total_credit: number;
    }>();

    for (const e of allCajaEntries) {
      const month = e.date.substring(0, 7);
      if (!dbCajaByMonth.has(month)) dbCajaByMonth.set(month, {
        cc_debit: 0, cc_credit: 0, cc_count: 0,
        rc_debit: 0, rc_credit: 0, rc_count: 0,
        total_debit: 0, total_credit: 0,
      });
      const m = dbCajaByMonth.get(month)!;
      const isCC = e.type === 'CC';
      if (e.movement === 'Debit') {
        if (isCC) { m.cc_debit += e.value; m.cc_count++; }
        else { m.rc_debit += e.value; m.rc_count++; }
        m.total_debit += e.value;
      } else {
        if (isCC) { m.cc_credit += e.value; m.cc_count++; }
        else { m.rc_credit += e.value; m.rc_count++; }
        m.total_credit += e.value;
      }
    }

    const monthlyComparison = cajaMonthly.map(bp => {
      const db = dbCajaByMonth.get(bp.month) || {
        cc_debit: 0, cc_credit: 0, cc_count: 0,
        rc_debit: 0, rc_credit: 0, rc_count: 0,
        total_debit: 0, total_credit: 0,
      };
      return {
        month: bp.month,
        bp_debit: bp.mov_debit,
        bp_credit: bp.mov_credit,
        db_cc_debit: db.cc_debit,
        db_cc_credit: db.cc_credit,
        db_rc_debit: db.rc_debit,
        db_rc_credit: db.rc_credit,
        db_total_debit: db.total_debit,
        db_total_credit: db.total_credit,
        remaining_gap_debit: bp.mov_debit - db.total_debit,
        remaining_gap_credit: bp.mov_credit - db.total_credit,
        gap_debit_pct: bp.mov_debit > 0 ? Math.round((bp.mov_debit - db.total_debit) / bp.mov_debit * 100) : 0,
        gap_credit_pct: bp.mov_credit > 0 ? Math.round((bp.mov_credit - db.total_credit) / bp.mov_credit * 100) : 0,
      };
    });

    // 6) Group by doc type + description
    const byDocType = new Map<string, { count: number; total_debit: number; total_credit: number }>();
    for (const e of allCajaEntries) {
      const key = e.type;
      if (!byDocType.has(key)) byDocType.set(key, { count: 0, total_debit: 0, total_credit: 0 });
      const d = byDocType.get(key)!;
      d.count++;
      if (e.movement === 'Debit') d.total_debit += e.value;
      else d.total_credit += e.value;
    }

    // Totals
    const dbTotalDebit = allCajaEntries.filter(e => e.movement === 'Debit').reduce((s, e) => s + e.value, 0);
    const dbTotalCredit = allCajaEntries.filter(e => e.movement === 'Credit').reduce((s, e) => s + e.value, 0);
    const bpTotalDebit = cajaMonthly.reduce((s, m) => s + m.mov_debit, 0);
    const bpTotalCredit = cajaMonthly.reduce((s, m) => s + m.mov_credit, 0);

    return NextResponse.json({
      investigation: `Análisis Caja (${CAJA}) — CC + RC + FV + FC — ${YEAR}`,

      caja_bp_monthly: cajaMonthly,

      totals: {
        bp_debitos: bpTotalDebit,
        bp_creditos: bpTotalCredit,
        db_debitos: dbTotalDebit,
        db_creditos: dbTotalCredit,
        gap_debitos: bpTotalDebit - dbTotalDebit,
        gap_creditos: bpTotalCredit - dbTotalCredit,
        gap_debit_pct: Math.round((bpTotalDebit - dbTotalDebit) / bpTotalDebit * 100),
        gap_credit_pct: Math.round((bpTotalCredit - dbTotalCredit) / bpTotalCredit * 100),
      },

      by_doc_type: Object.fromEntries(byDocType),

      monthly_bp_vs_db: monthlyComparison,

      invoice_items_touching_caja: invoiceItemsCaja.length,
      purchase_items_touching_caja: purchaseItemsCaja.length,
      voucher_items_touching_caja: voucherItemsCaja.length,
      journal_items_touching_caja: journalItemsCaja.length,

      all_caja_entries_sample: allCajaEntries.slice(0, 30),
      rc_entries: allCajaEntries.filter(e => e.type !== 'CC'),
      total_entries: allCajaEntries.length,

      missing_doc_types: {
        CE: 'Comprobante de Egreso — pagos desde caja/banco. NO disponible en API Siigo. Solo visible en Siigo Nube → Libro Auxiliar.',
        AC: 'Asiento de Cierre — ajustes contables de cierre. NO disponible en API Siigo.',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
