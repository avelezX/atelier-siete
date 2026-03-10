import { NextResponse } from 'next/server';
import { fetchTestBalanceReport } from '@/lib/siigo';
import { atelierTableAdmin } from '@/lib/supabase';
import * as XLSX from 'xlsx';

export const maxDuration = 60;

// Parse BP Excel
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

// Paginated fetch helper
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
    // === Investigation: 51352001 Procesamiento electrónico de datos — Dic 2025 ===
    const ACCOUNT_CODE = '51352001';
    const ACCOUNT_PREFIX = '513520';
    const MONTH_STR = '2025-12';
    const MONTH = 12;
    const YEAR = 2025;

    // 1. BP data
    const report = await fetchTestBalanceReport(YEAR, MONTH, MONTH);
    const bpAccounts = report.file_url ? await parseBalanceExcel(report.file_url) : [];
    const bpAccount = bpAccounts.find(a => a.code === ACCOUNT_CODE);
    const bpParent = bpAccounts.find(a => a.code === ACCOUNT_PREFIX);

    // 2. Purchase items hitting this account in Dec 2025
    const purchases = await fetchAllRows('purchases', 'id, date, name, supplier_name');
    const decPurchases = purchases.filter(p => (p.date as string)?.startsWith(MONTH_STR));
    const decPurchaseIds = new Set(decPurchases.map(p => p.id as string));

    const purchaseItems = await fetchAllRows(
      'purchase_items',
      'account_code, price, quantity, purchase_id, description',
      (q) => q.like('account_code', `${ACCOUNT_PREFIX}%`)
    );

    const decPurchaseItems = purchaseItems
      .filter(i => decPurchaseIds.has(i.purchase_id as string))
      .map(i => {
        const purchase = decPurchases.find(p => p.id === i.purchase_id);
        return {
          source: 'FC',
          invoice: (purchase?.name as string) || '',
          date: (purchase?.date as string) || '',
          supplier: (purchase?.supplier_name as string) || '',
          account_code: i.account_code as string,
          price: Number(i.price) || 0,
          quantity: Number(i.quantity) || 1,
          total: (Number(i.price) || 0) * (Number(i.quantity) || 1),
          description: (i.description as string) || '',
        };
      })
      .sort((a, b) => b.total - a.total);

    // 3. Journal items hitting this account in Dec 2025
    const journals = await fetchAllRows('journals', 'id, name, date');
    const decJournals = journals.filter(j => (j.date as string)?.startsWith(MONTH_STR));
    const decJournalIds = new Set(decJournals.map(j => j.id as string));

    const journalItems = await fetchAllRows(
      'journal_items',
      'account_code, movement, value, journal_id, description',
      (q) => q.like('account_code', `${ACCOUNT_PREFIX}%`)
    );

    const decJournalItems = journalItems
      .filter(i => decJournalIds.has(i.journal_id as string))
      .map(i => {
        const journal = decJournals.find(j => j.id === i.journal_id);
        return {
          source: 'CC',
          journal_name: (journal?.name as string) || '',
          date: (journal?.date as string) || '',
          account_code: i.account_code as string,
          movement: i.movement as string,
          value: Number(i.value) || 0,
          description: (i.description as string) || '',
        };
      })
      .sort((a, b) => b.value - a.value);

    const fcTotal = decPurchaseItems.reduce((s, i) => s + i.total, 0);
    const ccDebit = decJournalItems.filter(i => i.movement === 'Debit').reduce((s, i) => s + i.value, 0);
    const ccCredit = decJournalItems.filter(i => i.movement === 'Credit').reduce((s, i) => s + i.value, 0);

    return NextResponse.json({
      investigation: `${ACCOUNT_CODE} Procesamiento electrónico de datos — Dic 2025`,
      bp_data: bpAccount ? {
        code: bpAccount.code,
        name: bpAccount.name,
        saldo_inicial: Math.round(bpAccount.saldo_inicial),
        mov_debit: Math.round(bpAccount.mov_debit),
        mov_credit: Math.round(bpAccount.mov_credit),
        saldo_final: Math.round(bpAccount.saldo_final),
        net: Math.round(bpAccount.mov_debit - bpAccount.mov_credit),
      } : null,
      bp_parent: bpParent ? {
        code: bpParent.code,
        name: bpParent.name,
        mov_debit: Math.round(bpParent.mov_debit),
        mov_credit: Math.round(bpParent.mov_credit),
      } : null,
      db_summary: {
        fc_total: Math.round(fcTotal),
        cc_debit: Math.round(ccDebit),
        cc_credit: Math.round(ccCredit),
        db_total: Math.round(fcTotal + ccDebit - ccCredit),
        bp_total: bpAccount ? Math.round(bpAccount.mov_debit - bpAccount.mov_credit) : 0,
        gap: bpAccount ? Math.round((bpAccount.mov_debit - bpAccount.mov_credit) - (fcTotal + ccDebit - ccCredit)) : 0,
      },
      fc_items: decPurchaseItems,
      fc_count: decPurchaseItems.length,
      cc_items: decJournalItems,
      cc_count: decJournalItems.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
