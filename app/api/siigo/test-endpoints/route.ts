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

export async function GET() {
  try {
    const ACCOUNT = '11100501';
    const YEAR = 2025;

    const monthlyData: {
      month: string;
      saldo_inicial: number;
      mov_debit: number;
      mov_credit: number;
      saldo_final: number;
      net: number;
    }[] = [];

    // Fetch each month
    for (let m = 1; m <= 12; m++) {
      try {
        const report = await fetchTestBalanceReport(YEAR, m, m);
        if (report.file_url) {
          const accounts = await parseBalanceExcel(report.file_url);
          const acc = accounts.find(a => a.code === ACCOUNT);
          if (acc) {
            monthlyData.push({
              month: `${YEAR}-${String(m).padStart(2, '0')}`,
              saldo_inicial: Math.round(acc.saldo_inicial),
              mov_debit: Math.round(acc.mov_debit),
              mov_credit: Math.round(acc.mov_credit),
              saldo_final: Math.round(acc.saldo_final),
              net: Math.round(acc.mov_debit - acc.mov_credit),
            });
          }
        }
      } catch {
        // skip
      }
      if (m < 12) await new Promise(r => setTimeout(r, 500));
    }

    // Annual totals
    const totalDebit = monthlyData.reduce((s, m) => s + m.mov_debit, 0);
    const totalCredit = monthlyData.reduce((s, m) => s + m.mov_credit, 0);
    const firstSaldo = monthlyData.length > 0 ? monthlyData[0].saldo_inicial : 0;
    const lastSaldo = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].saldo_final : 0;

    // Also get all 111xx accounts from the annual BP for context
    let relatedAccounts: { code: string; name: string; saldo_final: number }[] = [];
    try {
      const annualReport = await fetchTestBalanceReport(YEAR, 1, 12);
      if (annualReport.file_url) {
        const annualAccs = await parseBalanceExcel(annualReport.file_url);
        relatedAccounts = annualAccs
          .filter(a => a.code.startsWith('1110'))
          .map(a => ({ code: a.code, name: a.name, saldo_final: Math.round(a.saldo_final) }))
          .sort((a, b) => a.code.localeCompare(b.code));
      }
    } catch {
      // skip
    }

    return NextResponse.json({
      investigation: `${ACCOUNT} Cuenta Corriente Bancolombia — ${YEAR}`,
      account: ACCOUNT,
      monthly: monthlyData,
      totals: {
        saldo_inicio_anio: firstSaldo,
        total_debitos: totalDebit,
        total_creditos: totalCredit,
        net_anual: totalDebit - totalCredit,
        saldo_fin_anio: lastSaldo,
      },
      related_accounts: relatedAccounts,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
