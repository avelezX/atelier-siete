import { NextResponse } from 'next/server';
import { fetchTestBalanceReport } from '@/lib/siigo';
import * as XLSX from 'xlsx';

export const maxDuration = 60;

// Parse BP Excel — return ALL accounts
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

  let headerRowIdx = -1;
  let codeColIdx = 0;
  let nameColIdx = 1;
  let numsStartIdx = 2;

  for (let i = 0; i < Math.min(allRows.length, 10); i++) {
    const row = allRows[i] || [];
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
    if (headerRowIdx < 0) {
      const firstCell = String(row[0] || '').toLowerCase();
      if (firstCell === 'nivel') {
        headerRowIdx = i;
        codeColIdx = 2;
        nameColIdx = 3;
        numsStartIdx = 4;
      }
    }
    if (headerRowIdx >= 0) break;
  }

  const accounts: BPAccount[] = [];
  const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;

  for (let i = startRow; i < allRows.length; i++) {
    const row = allRows[i] || [];
    const code = String(row[codeColIdx] || '').trim();
    if (!code || !/^\d{1,8}$/.test(code)) continue;

    const name = String(row[nameColIdx] || '').trim();
    const nums = row.slice(numsStartIdx).map((v) => {
      const n = Number(v);
      return isNaN(n) ? 0 : n;
    });

    accounts.push({
      code,
      name,
      saldo_inicial: nums[0] || 0,
      mov_debit: nums[1] || 0,
      mov_credit: nums[2] || 0,
      saldo_final: nums[3] || 0,
    });
  }

  return accounts;
}

export async function GET() {
  try {
    // === Configurable investigation ===
    const ACCOUNT_PREFIX = '5135';  // Servicios
    const MONTH = 12;               // Diciembre
    const YEAR = 2025;

    const report = await fetchTestBalanceReport(YEAR, MONTH, MONTH);
    if (!report.file_url) {
      return NextResponse.json({ error: `No file_url from Siigo for ${YEAR}-${MONTH}` }, { status: 500 });
    }

    const allAccounts = await parseBalanceExcel(report.file_url);

    // Filter all accounts under prefix
    const targetAccounts = allAccounts
      .filter(a => a.code.startsWith(ACCOUNT_PREFIX))
      .sort((a, b) => a.code.localeCompare(b.code));

    // Identify leaf accounts (no children)
    const leafAccounts = targetAccounts.filter(acc =>
      !targetAccounts.some(other => other.code !== acc.code && other.code.startsWith(acc.code))
    );

    const leafDebitTotal = leafAccounts.reduce((s, a) => s + a.mov_debit, 0);
    const leafCreditTotal = leafAccounts.reduce((s, a) => s + a.mov_credit, 0);

    const parentAccount = allAccounts.find(a => a.code === ACCOUNT_PREFIX);

    return NextResponse.json({
      investigation: `${ACCOUNT_PREFIX} ${parentAccount?.name || '?'} - ${YEAR}-${String(MONTH).padStart(2,'0')} (Balance de Prueba Siigo)`,
      parent_account: parentAccount ? {
        code: parentAccount.code,
        name: parentAccount.name,
        mov_debit: Math.round(parentAccount.mov_debit),
        mov_credit: Math.round(parentAccount.mov_credit),
        net: Math.round(parentAccount.mov_debit - parentAccount.mov_credit),
      } : null,
      all_sub_accounts: targetAccounts.map(a => ({
        code: a.code,
        name: a.name,
        saldo_inicial: Math.round(a.saldo_inicial),
        mov_debit: Math.round(a.mov_debit),
        mov_credit: Math.round(a.mov_credit),
        saldo_final: Math.round(a.saldo_final),
        net_movement: Math.round(a.mov_debit - a.mov_credit),
        is_leaf: leafAccounts.some(l => l.code === a.code),
      })),
      leaf_summary: {
        count: leafAccounts.length,
        total_debit: Math.round(leafDebitTotal),
        total_credit: Math.round(leafCreditTotal),
        net: Math.round(leafDebitTotal - leafCreditTotal),
      },
      top_items: leafAccounts
        .sort((a, b) => b.mov_debit - a.mov_debit)
        .slice(0, 20)
        .map(a => ({
          code: a.code,
          name: a.name,
          mov_debit: Math.round(a.mov_debit),
          mov_credit: Math.round(a.mov_credit),
          net: Math.round(a.mov_debit - a.mov_credit),
        })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
