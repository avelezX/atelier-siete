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

    // 4. Find the header row (contains "Código" or "Cuenta" or starts with column names)
    // Then data rows follow
    let headerRowIdx = -1;
    const rawDebug: string[] = [];
    for (let i = 0; i < Math.min(allRows.length, 10); i++) {
      const rowStr = (allRows[i] || []).map(c => String(c || '')).join(' | ');
      rawDebug.push(`Row ${i}: ${rowStr.substring(0, 200)}`);
      const row = allRows[i] || [];
      const firstCell = String(row[0] || '').toLowerCase();
      const secondCell = String(row[1] || '').toLowerCase();
      if (firstCell.includes('código') || firstCell.includes('codigo') ||
          secondCell.includes('cuenta') || firstCell === 'code') {
        headerRowIdx = i;
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
      prev_debit: number;
      prev_credit: number;
      mov_debit: number;
      mov_credit: number;
      new_debit: number;
      new_credit: number;
    }

    const accounts: BalanceRow[] = [];
    const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;

    for (let i = startRow; i < allRows.length; i++) {
      const row = allRows[i] || [];
      const code = String(row[0] || '').trim();
      // Valid PUC codes: 1-9 digits, typically 1-8 digits
      if (!code || !/^\d{1,8}$/.test(code)) continue;

      const name = String(row[1] || '').trim();
      const nums = row.slice(2).map((v) => {
        const n = Number(v);
        return isNaN(n) ? 0 : n;
      });

      accounts.push({
        code,
        account_name: name,
        prev_debit: nums[0] || 0,
        prev_credit: nums[1] || 0,
        mov_debit: nums[2] || 0,
        mov_credit: nums[3] || 0,
        new_debit: nums[4] || 0,
        new_credit: nums[5] || 0,
      });
    }

    // 6. Group by major PUC categories for quick comparison
    const categories: Record<string, { mov_debit: number; mov_credit: number; new_balance: number; accounts: number }> = {};

    const categoryNames: Record<string, string> = {
      '1': 'Activos',
      '2': 'Pasivos',
      '3': 'Patrimonio',
      '4': 'Ingresos',
      '5': 'Gastos',
      '6': 'Costo de Ventas',
      '7': 'Costos de Producción',
      '41': 'Ingresos Operacionales',
      '42': 'Ingresos No Operacionales',
      '51': 'Gastos Admin',
      '52': 'Gastos de Venta',
      '53': 'Gastos No Operacionales',
      '5305': 'Gastos Financieros',
      '6135': 'Costo de Ventas Comercio',
    };

    // Subcategory totals for comparison with resumen
    const subcategories: Record<string, { name: string; mov_debit: number; mov_credit: number; count: number }> = {};

    for (const acc of accounts) {
      // Only process leaf-level accounts (usually 6+ digits)
      // But also allow 4-digit for summary
      const prefix4 = acc.code.substring(0, 4);
      const prefix2 = acc.code.substring(0, 2);
      const prefix1 = acc.code.substring(0, 1);

      // 4-digit subcategory
      if (acc.code.length >= 4) {
        if (!subcategories[prefix4]) {
          subcategories[prefix4] = {
            name: categoryNames[prefix4] || acc.account_name,
            mov_debit: 0,
            mov_credit: 0,
            count: 0,
          };
        }
        // Only add leaf accounts (longest codes) to avoid double counting
        if (acc.code.length >= 6) {
          subcategories[prefix4].mov_debit += acc.mov_debit;
          subcategories[prefix4].mov_credit += acc.mov_credit;
          subcategories[prefix4].count++;
        }
      }

      // 2-digit category
      if (!categories[prefix2]) {
        categories[prefix2] = { mov_debit: 0, mov_credit: 0, new_balance: 0, accounts: 0 };
      }
      if (acc.code.length >= 6) {
        categories[prefix2].mov_debit += acc.mov_debit;
        categories[prefix2].mov_credit += acc.mov_credit;
        categories[prefix2].new_balance += acc.new_debit - acc.new_credit;
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
        raw_first_rows: rawDebug,
      },
      categories: Object.entries(categories)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([code, data]) => ({
          code,
          name: categoryNames[code] || code,
          ...data,
        })),
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
