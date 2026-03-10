import { NextResponse } from 'next/server';
import { fetchTestBalanceReport } from '@/lib/siigo';
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

function investigatePrefix(allAccounts: BPAccount[], prefix: string) {
  const targetAccounts = allAccounts
    .filter(a => a.code.startsWith(prefix))
    .sort((a, b) => a.code.localeCompare(b.code));

  const leafAccounts = targetAccounts.filter(acc =>
    !targetAccounts.some(other => other.code !== acc.code && other.code.startsWith(acc.code))
  );

  const parentAccount = allAccounts.find(a => a.code === prefix);

  return {
    parent: parentAccount ? {
      code: parentAccount.code,
      name: parentAccount.name,
      mov_debit: Math.round(parentAccount.mov_debit),
      mov_credit: Math.round(parentAccount.mov_credit),
      net_credit: Math.round(parentAccount.mov_credit - parentAccount.mov_debit),
    } : null,
    all_accounts: targetAccounts.map(a => ({
      code: a.code,
      name: a.name,
      saldo_inicial: Math.round(a.saldo_inicial),
      mov_debit: Math.round(a.mov_debit),
      mov_credit: Math.round(a.mov_credit),
      saldo_final: Math.round(a.saldo_final),
      net_credit: Math.round(a.mov_credit - a.mov_debit),
      is_leaf: leafAccounts.some(l => l.code === a.code),
    })),
    leaf_summary: {
      count: leafAccounts.length,
      total_debit: Math.round(leafAccounts.reduce((s, a) => s + a.mov_debit, 0)),
      total_credit: Math.round(leafAccounts.reduce((s, a) => s + a.mov_credit, 0)),
      net_credit: Math.round(leafAccounts.reduce((s, a) => s + (a.mov_credit - a.mov_debit), 0)),
    },
    top_items: leafAccounts
      .filter(a => a.mov_debit > 0 || a.mov_credit > 0)
      .sort((a, b) => (b.mov_credit - b.mov_debit) - (a.mov_credit - a.mov_debit))
      .map(a => ({
        code: a.code,
        name: a.name,
        mov_debit: Math.round(a.mov_debit),
        mov_credit: Math.round(a.mov_credit),
        net_credit: Math.round(a.mov_credit - a.mov_debit),
      })),
  };
}

export async function GET() {
  try {
    // Fetch annual BP for full year view of Otros Ingresos (42)
    const annualReport = await fetchTestBalanceReport(2025, 1, 12);
    if (!annualReport.file_url) {
      return NextResponse.json({ error: 'No file_url from Siigo for annual 2025' }, { status: 500 });
    }
    const annualAccounts = await parseBalanceExcel(annualReport.file_url);
    const annual42 = investigatePrefix(annualAccounts, '42');

    // Also fetch monthly breakdown for months with activity
    const monthlyDetail: Record<string, unknown> = {};
    const monthsToCheck = [1, 3, 5, 7, 9, 10, 11, 12]; // months that show activity in the resumen

    for (const m of monthsToCheck) {
      try {
        const report = await fetchTestBalanceReport(2025, m, m);
        if (report.file_url) {
          const accounts = await parseBalanceExcel(report.file_url);
          const detail = investigatePrefix(accounts, '42');
          if (detail.leaf_summary.net_credit !== 0) {
            monthlyDetail[`2025-${String(m).padStart(2, '0')}`] = {
              net_credit: detail.leaf_summary.net_credit,
              top_items: detail.top_items,
            };
          }
        }
      } catch {
        // skip month
      }
      if (m < monthsToCheck[monthsToCheck.length - 1]) await new Promise(r => setTimeout(r, 500));
    }

    return NextResponse.json({
      investigation: 'Otros Ingresos (42) — 2025 completo',
      annual: annual42,
      monthly_detail: monthlyDetail,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
