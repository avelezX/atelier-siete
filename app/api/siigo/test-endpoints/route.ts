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
    const YEAR = 2025;

    // Get annual BP and find ALL accounts under 11 (Disponible = Caja + Bancos)
    const annualReport = await fetchTestBalanceReport(YEAR, 1, 12);
    if (!annualReport.file_url) {
      return NextResponse.json({ error: 'No annual report available' }, { status: 500 });
    }

    const allAccounts = await parseBalanceExcel(annualReport.file_url);

    // All accounts under 11 (Disponible): 1105=Caja, 1110=Bancos, 1120=Cuentas de Ahorro, etc.
    const disponible = allAccounts
      .filter(a => a.code.startsWith('11'))
      .map(a => ({
        code: a.code,
        name: a.name,
        saldo_inicial: Math.round(a.saldo_inicial),
        mov_debit: Math.round(a.mov_debit),
        mov_credit: Math.round(a.mov_credit),
        saldo_final: Math.round(a.saldo_final),
        level: a.code.length <= 2 ? 'clase' : a.code.length <= 4 ? 'grupo' : a.code.length <= 6 ? 'cuenta' : 'auxiliar',
      }))
      .sort((a, b) => a.code.localeCompare(b.code));

    // Specifically highlight caja (1105) accounts
    const cajaAccounts = disponible.filter(a => a.code.startsWith('1105'));
    const bancoAccounts = disponible.filter(a => a.code.startsWith('1110'));

    return NextResponse.json({
      investigation: `Cuentas de Disponible (11) — Caja y Bancos — ${YEAR}`,
      year: YEAR,
      all_disponible: disponible,
      caja_1105: cajaAccounts.length > 0 ? cajaAccounts : 'No hay cuentas de caja (1105)',
      bancos_1110: bancoAccounts,
      summary: {
        total_cuentas: disponible.filter(a => a.level === 'auxiliar').length,
        caja_exists: cajaAccounts.length > 0,
        banco_exists: bancoAccounts.length > 0,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
