import * as XLSX from 'xlsx';

export interface BancolombiaMetadata {
  clientName: string;
  accountNumber: string;
  dateFrom: string;
  dateTo: string;
  balanceAnterior: number;
  totalAbonos: number;
  totalCargos: number;
  balanceActual: number;
}

export interface ParsedTransaction {
  date: string;
  description: string;
  reference: string | null;
  branch: string | null;
  amount: number;
  balance: number;
  type: 'credit' | 'debit';
}

export interface ParseResult {
  metadata: BancolombiaMetadata;
  transactions: ParsedTransaction[];
  period: string;
  warnings: string[];
}

const MONTH_MAP: Record<string, number> = {
  'ENE': 1, 'FEB': 2, 'MAR': 3, 'ABR': 4, 'MAY': 5, 'JUN': 6,
  'JUL': 7, 'AGO': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DIC': 12,
};

function parseCurrency(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const s = String(value).replace(/,/g, '').replace(/\$/g, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function cellValue(sheet: XLSX.WorkSheet, row: number, col: number): string {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = sheet[addr];
  if (!cell) return '';
  return cell.w ?? String(cell.v ?? '');
}

function extractYearFromFilename(filename: string): number {
  const yearMatch = filename.match(/20[2-3]\d/);
  if (yearMatch) return parseInt(yearMatch[0]);
  return new Date().getFullYear();
}

function extractMonthFromFilename(filename: string): number | null {
  const upper = filename.toUpperCase();
  for (const [abbr, num] of Object.entries(MONTH_MAP)) {
    if (upper.includes(abbr)) return num;
  }
  return null;
}

export function parseBancolombiaExcel(buffer: ArrayBuffer, filename: string): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'array', raw: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const warnings: string[] = [];

  const clientName = cellValue(sheet, 3, 0);
  const accountNumber = cellValue(sheet, 7, 3);
  const dateFrom = cellValue(sheet, 7, 0);
  const dateTo = cellValue(sheet, 7, 1);

  const balanceAnterior = parseCurrency(cellValue(sheet, 11, 0));
  const totalAbonos = parseCurrency(cellValue(sheet, 11, 1));
  const totalCargos = parseCurrency(cellValue(sheet, 11, 2));
  const balanceActual = parseCurrency(cellValue(sheet, 11, 3));

  const metadata: BancolombiaMetadata = {
    clientName, accountNumber, dateFrom, dateTo,
    balanceAnterior, totalAbonos, totalCargos, balanceActual,
  };

  const year = extractYearFromFilename(filename);
  const filenameMonth = extractMonthFromFilename(filename);

  let headerRow = 14;
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

  const headerCheck = cellValue(sheet, headerRow, 0).toUpperCase();
  if (!headerCheck.includes('FECHA')) {
    for (let r = 12; r <= 18; r++) {
      if (cellValue(sheet, r, 0).toUpperCase().includes('FECHA')) {
        headerRow = r;
        break;
      }
    }
  }

  let descCol = 1;
  for (let c = 0; c <= 5; c++) {
    if (cellValue(sheet, headerRow, c).toUpperCase().includes('DESCRI')) {
      descCol = c;
      break;
    }
  }

  const transactions: ParsedTransaction[] = [];

  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const fechaRaw = cellValue(sheet, r, 0).trim();
    if (!fechaRaw) continue;

    let date: string;
    if (fechaRaw.includes('/')) {
      const parts = fechaRaw.split('/');
      if (parts.length < 2) {
        warnings.push(`Fecha invalida en fila ${r + 1}: ${fechaRaw}`);
        continue;
      }
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      if (isNaN(day) || isNaN(month) || month < 1 || month > 12 || day < 1 || day > 31) {
        warnings.push(`Fecha invalida en fila ${r + 1}: ${fechaRaw}`);
        continue;
      }
      date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    } else {
      warnings.push(`Fecha no reconocida en fila ${r + 1}: ${fechaRaw}`);
      continue;
    }

    const description = cellValue(sheet, r, descCol).trim();
    const branch = cellValue(sheet, r, 2).trim() || null;
    const reference = cellValue(sheet, r, 3).trim() || null;
    const valor = parseCurrency(cellValue(sheet, r, 4));
    const balance = parseCurrency(cellValue(sheet, r, 5));

    if (valor === 0 && !description) continue;

    const type: 'credit' | 'debit' = valor > 0 ? 'credit' : 'debit';

    transactions.push({
      date,
      description,
      reference,
      branch,
      amount: Math.abs(valor),
      balance,
      type,
    });
  }

  let period: string;
  if (filenameMonth) {
    period = `${year}-${String(filenameMonth).padStart(2, '0')}`;
  } else if (transactions.length > 0) {
    period = transactions[0].date.substring(0, 7);
  } else {
    period = `${year}-01`;
  }

  return { metadata, transactions, period, warnings };
}
