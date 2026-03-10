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

    // 1) Monthly BP for Caja (11050501) to see when it went negative
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

    // 2) Search DB for arriendo-related items touching caja or banco accounts
    // Look for purchases from rent suppliers
    const RENT_SUPPLIERS = ['BERNARDO', 'PRANHA', 'ATELIER'];
    const purchases = await fetchAllRows('purchases', 'id, date, name, supplier_name');
    const yearPurchases = purchases.filter(p => (p.date as string)?.startsWith(String(YEAR)));

    const rentPurchases = yearPurchases.filter(p => {
      const supplier = ((p.supplier_name as string) || '').toUpperCase();
      return RENT_SUPPLIERS.some(s => supplier.includes(s));
    });

    // Get all items for these rent purchases
    const rentPurchaseIds = rentPurchases.map(p => p.id as string);
    const allPurchaseItems = rentPurchaseIds.length > 0
      ? await fetchAllRows('purchase_items', 'account_code, price, quantity, purchase_id, description',
          (q) => q.in('purchase_id', rentPurchaseIds))
      : [];

    // Group rent purchases with their items and account codes
    const rentDetail = rentPurchases.map(p => {
      const items = allPurchaseItems.filter(i => i.purchase_id === p.id);
      return {
        date: p.date,
        doc: p.name,
        supplier: p.supplier_name,
        items: items.map(i => ({
          account: i.account_code,
          description: i.description,
          amount: Math.round((Number(i.price) || 0) * (Number(i.quantity) || 1)),
        })),
      };
    });

    // 3) Search journal items for entries touching 1105 or 1110 with rent-related descriptions
    const journalItemsCaja = await fetchAllRows(
      'journal_items', 'account_code, movement, value, journal_id, description',
      (q) => q.like('account_code', '1105%')
    );
    const journalItemsBanco = await fetchAllRows(
      'journal_items', 'account_code, movement, value, journal_id, description',
      (q) => q.like('account_code', '1110%')
    );

    // Get journals for these items
    const journalIds = [...new Set([
      ...journalItemsCaja.map(i => i.journal_id as string),
      ...journalItemsBanco.map(i => i.journal_id as string),
    ])];
    const journals = journalIds.length > 0
      ? await fetchAllRows('journals', 'id, date, name', (q) => q.in('id', journalIds))
      : [];
    const yearJournals = journals.filter(j => (j.date as string)?.startsWith(String(YEAR)));
    const journalMap = new Map(yearJournals.map(j => [j.id as string, j]));

    // Filter to year and group
    const cashBankJournalEntries = [...journalItemsCaja, ...journalItemsBanco]
      .filter(i => journalMap.has(i.journal_id as string))
      .map(i => {
        const j = journalMap.get(i.journal_id as string)!;
        return {
          date: j.date,
          doc: j.name,
          account: i.account_code,
          movement: i.movement,
          value: Math.round(Number(i.value) || 0),
          description: i.description,
        };
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    // Filter for rent-related keywords
    const rentKeywords = ['arriendo', 'arrendamiento', 'bernardo', 'pranha', 'atelier', 'alquiler'];
    const rentJournalEntries = cashBankJournalEntries.filter(e => {
      const desc = ((e.description as string) || '').toLowerCase();
      const doc = ((e.doc as string) || '').toLowerCase();
      return rentKeywords.some(k => desc.includes(k) || doc.includes(k));
    });

    // Summary of all cash/bank journal movements by month
    const cashBankByMonth = new Map<string, { caja_debit: number; caja_credit: number; banco_debit: number; banco_credit: number }>();
    for (const e of cashBankJournalEntries) {
      const month = String(e.date).substring(0, 7);
      if (!cashBankByMonth.has(month)) cashBankByMonth.set(month, { caja_debit: 0, caja_credit: 0, banco_debit: 0, banco_credit: 0 });
      const m = cashBankByMonth.get(month)!;
      const isCaja = String(e.account).startsWith('1105');
      if (e.movement === 'Debit') {
        if (isCaja) m.caja_debit += e.value; else m.banco_debit += e.value;
      } else {
        if (isCaja) m.caja_credit += e.value; else m.banco_credit += e.value;
      }
    }

    return NextResponse.json({
      investigation: `Pagos de arriendo vs Caja/Banco — ${YEAR}`,

      caja_monthly: cajaMonthly,
      caja_totals: {
        saldo_inicio: cajaMonthly[0]?.saldo_inicial || 0,
        total_debitos: cajaMonthly.reduce((s, m) => s + m.mov_debit, 0),
        total_creditos: cajaMonthly.reduce((s, m) => s + m.mov_credit, 0),
        saldo_fin: cajaMonthly[cajaMonthly.length - 1]?.saldo_final || 0,
      },

      rent_purchases_in_db: rentDetail,
      rent_journal_entries_cash_bank: rentJournalEntries.length > 0 ? rentJournalEntries : 'No se encontraron CCs de arriendo en caja/banco',

      cash_bank_journal_summary: Object.fromEntries(
        Array.from(cashBankByMonth.entries()).sort(([a], [b]) => a.localeCompare(b))
      ),

      total_cash_bank_journal_entries: cashBankJournalEntries.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
