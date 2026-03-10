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

    // 2) ALL journal items touching caja (11050501) — to see what CC documents move caja
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

    const cajaJournalEntries = journalItemsCaja
      .filter(i => cajaJournalMap.has(i.journal_id as string))
      .map(i => {
        const j = cajaJournalMap.get(i.journal_id as string)!;
        return {
          date: j.date as string,
          doc: j.name as string,
          movement: i.movement as string,
          value: Math.round(Number(i.value) || 0),
          description: (i.description as string) || '',
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    // 3) Group CC entries by description pattern to understand what moves caja
    const descPatterns = new Map<string, { count: number; total_debit: number; total_credit: number; docs: string[] }>();
    for (const e of cajaJournalEntries) {
      // Normalize description to group similar ones
      const desc = e.description.toUpperCase().trim() || '(sin descripción)';
      if (!descPatterns.has(desc)) descPatterns.set(desc, { count: 0, total_debit: 0, total_credit: 0, docs: [] });
      const p = descPatterns.get(desc)!;
      p.count++;
      if (e.movement === 'Debit') p.total_debit += e.value;
      else p.total_credit += e.value;
      if (!p.docs.includes(e.doc)) p.docs.push(e.doc);
    }

    // 4) Check invoices (FV) — do they have payment info touching caja?
    // Invoice items with account 1105
    const invoiceItemsCaja = await fetchAllRows(
      'invoice_items', 'account_code, price, quantity, invoice_id, description',
      (q) => q.like('account_code', '1105%')
    ).catch(() => [] as Record<string, unknown>[]);

    // 5) Check purchase items touching caja
    const purchaseItemsCaja = await fetchAllRows(
      'purchase_items', 'account_code, price, quantity, purchase_id, description',
      (q) => q.like('account_code', '1105%')
    ).catch(() => [] as Record<string, unknown>[]);

    // 6) Monthly summary: BP vs what we see in DB
    const dbCajaByMonth = new Map<string, { cc_debit: number; cc_credit: number; cc_count: number }>();
    for (const e of cajaJournalEntries) {
      const month = e.date.substring(0, 7);
      if (!dbCajaByMonth.has(month)) dbCajaByMonth.set(month, { cc_debit: 0, cc_credit: 0, cc_count: 0 });
      const m = dbCajaByMonth.get(month)!;
      m.cc_count++;
      if (e.movement === 'Debit') m.cc_debit += e.value;
      else m.cc_credit += e.value;
    }

    // Compare BP vs DB per month
    const monthlyComparison = cajaMonthly.map(bp => {
      const db = dbCajaByMonth.get(bp.month) || { cc_debit: 0, cc_credit: 0, cc_count: 0 };
      return {
        month: bp.month,
        bp_debit: bp.mov_debit,
        bp_credit: bp.mov_credit,
        db_cc_debit: db.cc_debit,
        db_cc_credit: db.cc_credit,
        db_cc_count: db.cc_count,
        gap_debit: bp.mov_debit - db.cc_debit,
        gap_credit: bp.mov_credit - db.cc_credit,
        gap_debit_pct: bp.mov_debit > 0 ? Math.round((bp.mov_debit - db.cc_debit) / bp.mov_debit * 100) : 0,
        gap_credit_pct: bp.mov_credit > 0 ? Math.round((bp.mov_credit - db.cc_credit) / bp.mov_credit * 100) : 0,
      };
    });

    // 7) All unique caja CC entries — full detail for analysis
    const allCajaEntries = cajaJournalEntries.map(e => ({
      date: e.date,
      doc: e.doc,
      movement: e.movement,
      value: e.value,
      description: e.description,
    }));

    // Sort description patterns by total movement
    const sortedPatterns = Array.from(descPatterns.entries())
      .map(([desc, data]) => ({ description: desc, ...data }))
      .sort((a, b) => (b.total_debit + b.total_credit) - (a.total_debit + a.total_credit));

    return NextResponse.json({
      investigation: `Análisis profundo de Caja (${CAJA}) — ${YEAR}`,

      caja_bp_monthly: cajaMonthly,
      caja_totals: {
        bp_saldo_inicio: cajaMonthly[0]?.saldo_inicial || 0,
        bp_total_debitos: cajaMonthly.reduce((s, m) => s + m.mov_debit, 0),
        bp_total_creditos: cajaMonthly.reduce((s, m) => s + m.mov_credit, 0),
        bp_saldo_fin: cajaMonthly[cajaMonthly.length - 1]?.saldo_final || 0,
        db_cc_total_debitos: cajaJournalEntries.filter(e => e.movement === 'Debit').reduce((s, e) => s + e.value, 0),
        db_cc_total_creditos: cajaJournalEntries.filter(e => e.movement === 'Credit').reduce((s, e) => s + e.value, 0),
      },

      monthly_bp_vs_db: monthlyComparison,

      description_patterns: sortedPatterns,

      invoice_items_touching_caja: invoiceItemsCaja.length,
      purchase_items_touching_caja: purchaseItemsCaja.length,

      all_caja_cc_entries: allCajaEntries,
      total_cc_entries: allCajaEntries.length,

      doc_types_in_caja: {
        note: 'En Siigo, los documentos que mueven caja son: FV (con pago efectivo), CE (Comprobante Egreso), RC (Recibo Caja), CC (Comprobante Contable), AC (Asiento Cierre). Solo CC está en nuestra DB.',
        available_via_api: ['CC (Comprobante Contable)', 'FV (Factura Venta)', 'FC (Factura Compra)', 'NC (Nota Crédito)', 'RC (Recibo Caja)'],
        not_available_via_api: ['CE (Comprobante Egreso)', 'AC (Asiento Cierre)'],
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
