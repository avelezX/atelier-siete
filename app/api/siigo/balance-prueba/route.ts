import { NextRequest, NextResponse } from 'next/server';
import { fetchTestBalanceReport } from '@/lib/siigo';
import * as XLSX from 'xlsx';

export const maxDuration = 60;

// GET /api/siigo/balance-prueba?year=2025&month_start=1&month_end=12
export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const year = parseInt(url.searchParams.get('year') || '2025');
    const monthStart = parseInt(url.searchParams.get('month_start') || '1');
    const monthEnd = parseInt(url.searchParams.get('month_end') || '12');

    // 1. Request report from Siigo
    const report = await fetchTestBalanceReport(year, monthStart, monthEnd);
    if (!report.file_url) {
      return NextResponse.json({ error: 'No file_url in response', report }, { status: 500 });
    }

    // 2. Download the Excel file
    const fileRes = await fetch(report.file_url);
    if (!fileRes.ok) {
      return NextResponse.json({ error: `Failed to download file: ${fileRes.status}` }, { status: 500 });
    }
    const buffer = await fileRes.arrayBuffer();

    // 3. Parse the Excel — use raw array of arrays to handle Siigo's header rows
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const allRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    // 4. Find the header row and detect column layout
    // Siigo Balance de Prueba columns:
    //   Nivel | Transaccional | Código cuenta contable | Nombre Cuenta contable | Saldo Inicial | Mov Débito | Mov Crédito | Saldo final
    let headerRowIdx = -1;
    let codeColIdx = 0;    // column index for the PUC code
    let nameColIdx = 1;    // column index for account name
    let numsStartIdx = 2;  // column index where numeric columns start

    const rawDebug: string[] = [];
    for (let i = 0; i < Math.min(allRows.length, 10); i++) {
      const rowStr = (allRows[i] || []).map(c => String(c || '')).join(' | ');
      rawDebug.push(`Row ${i}: ${rowStr.substring(0, 300)}`);
      const row = allRows[i] || [];

      // Scan each cell for the code column header
      for (let col = 0; col < row.length; col++) {
        const cell = String(row[col] || '').toLowerCase();
        if (cell.includes('código cuenta') || cell.includes('codigo cuenta') || cell === 'código' || cell === 'codigo') {
          headerRowIdx = i;
          codeColIdx = col;
          // Name column is typically the next one
          nameColIdx = col + 1;
          // Numeric columns start after the name column
          numsStartIdx = col + 2;
          break;
        }
      }

      // Fallback: check for "Nivel" in first cell (Siigo format)
      if (headerRowIdx < 0) {
        const firstCell = String(row[0] || '').toLowerCase();
        if (firstCell === 'nivel') {
          headerRowIdx = i;
          codeColIdx = 2;   // Siigo puts code in column C
          nameColIdx = 3;   // Name in column D
          numsStartIdx = 4; // Numbers start at column E
        }
      }
    }

    // Extract headers
    const headers = headerRowIdx >= 0
      ? (allRows[headerRowIdx] || []).map(c => String(c || '').trim())
      : [];

    // 5. Parse data rows (after header)
    interface BalanceRow {
      code: string;
      account_name: string;
      initial_balance: number;
      mov_debit: number;
      mov_credit: number;
      final_balance: number;
    }

    const accounts: BalanceRow[] = [];
    const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;

    for (let i = startRow; i < allRows.length; i++) {
      const row = allRows[i] || [];
      const code = String(row[codeColIdx] || '').trim();
      // Valid PUC codes: 1-8 digits
      if (!code || !/^\d{1,8}$/.test(code)) continue;

      const name = String(row[nameColIdx] || '').trim();
      const nums = row.slice(numsStartIdx).map((v) => {
        const n = Number(v);
        return isNaN(n) ? 0 : n;
      });

      // Siigo format: Saldo Inicial | Mov Débito | Mov Crédito | Saldo Final
      accounts.push({
        code,
        account_name: name,
        initial_balance: nums[0] || 0,
        mov_debit: nums[1] || 0,
        mov_credit: nums[2] || 0,
        final_balance: nums[3] || 0,
      });
    }

    // 6. Group by major PUC categories
    const categoryNames: Record<string, string> = {
      '1': 'Activos', '2': 'Pasivos', '3': 'Patrimonio',
      '4': 'Ingresos', '5': 'Gastos', '6': 'Costo de Ventas',
      '41': 'Ingresos Operacionales', '42': 'Ingresos No Operacionales',
      '51': 'Gastos Admin', '52': 'Gastos de Venta', '53': 'Gastos No Operacionales',
      '5305': 'Gastos Financieros', '6135': 'Costo de Ventas Comercio',
    };

    const categories: Record<string, { mov_debit: number; mov_credit: number; final_balance: number; accounts: number }> = {};
    const subcategories: Record<string, { name: string; mov_debit: number; mov_credit: number; count: number }> = {};

    for (const acc of accounts) {
      const prefix4 = acc.code.substring(0, 4);
      const prefix2 = acc.code.substring(0, 2);

      // Only count leaf accounts (6+ digits) to avoid double counting
      if (acc.code.length >= 6) {
        // 4-digit subcategory
        if (!subcategories[prefix4]) {
          subcategories[prefix4] = { name: categoryNames[prefix4] || acc.account_name, mov_debit: 0, mov_credit: 0, count: 0 };
        }
        subcategories[prefix4].mov_debit += acc.mov_debit;
        subcategories[prefix4].mov_credit += acc.mov_credit;
        subcategories[prefix4].count++;

        // 2-digit category
        if (!categories[prefix2]) {
          categories[prefix2] = { mov_debit: 0, mov_credit: 0, final_balance: 0, accounts: 0 };
        }
        categories[prefix2].mov_debit += acc.mov_debit;
        categories[prefix2].mov_credit += acc.mov_credit;
        categories[prefix2].final_balance += acc.final_balance;
        categories[prefix2].accounts++;
      }
    }

    return NextResponse.json({
      meta: {
        year,
        month_start: monthStart,
        month_end: monthEnd,
        file_url: report.file_url,
        sheets: workbook.SheetNames,
        headers,
        total_rows: allRows.length,
        parsed_accounts: accounts.length,
        header_row_idx: headerRowIdx,
        code_col: codeColIdx,
        raw_first_rows: rawDebug,
      },
      categories: Object.entries(categories)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([code, data]) => ({ code, name: categoryNames[code] || code, ...data })),
      subcategories_5x: Object.entries(subcategories)
        .filter(([code]) => code.startsWith('5') || code.startsWith('6'))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([code, data]) => ({ code, ...data })),
      raw_accounts: accounts,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
