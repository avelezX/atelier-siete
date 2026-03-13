import * as XLSX from 'xlsx';

export interface DianDocument {
  cufe: string;
  number: string;
  prefix: string | null;
  document_type: string;
  document_group: string | null;
  issue_date: string;
  reception_date: string | null;
  issuer_nit: string;
  issuer_name: string;
  receiver_nit: string;
  receiver_name: string;
  amount: number;
  tax_amount: number;
  currency: string;
  status: string | null;
  metadata: Record<string, number> | null;
}

export interface DianParseResult {
  documents: DianDocument[];
  skipped: number;
  warnings: string[];
  period: string;
}

function parseDecimal(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function parseDianDate(value: unknown): string | null {
  if (!value) return null;
  const str = String(value).trim();
  const match = str.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }
  return null;
}

function parseDianTimestamp(value: unknown): string | null {
  if (!value) return null;
  const str = String(value).trim();
  const match = str.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, day, month, year, hh, mm, ss] = match;
    return `${year}-${month}-${day}T${hh}:${mm}:${ss}`;
  }
  return null;
}

export function parseDianExcel(buffer: ArrayBuffer): DianParseResult {
  const workbook = XLSX.read(buffer, { type: 'array', raw: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const warnings: string[] = [];

  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  if (rows.length < 2) {
    return { documents: [], skipped: 0, warnings: ['El archivo está vacío'], period: '' };
  }

  const documents: DianDocument[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || row.every(v => v === null)) continue;

    const documentType = String(row[0] ?? '').trim();

    if (documentType === 'Application response') {
      skipped++;
      continue;
    }

    const cufe = String(row[1] ?? '').trim();
    if (!cufe) {
      warnings.push(`Fila ${i + 1}: CUFE vacío, se omite`);
      skipped++;
      continue;
    }

    const folio = String(row[2] ?? '').trim();
    const prefix = String(row[3] ?? '').trim() || null;
    const currency = String(row[4] ?? 'COP').trim() || 'COP';
    const issueDate = parseDianDate(row[7]);
    const receptionDate = parseDianTimestamp(row[8]);

    if (!issueDate) {
      warnings.push(`Fila ${i + 1}: Fecha de emisión inválida, se omite`);
      skipped++;
      continue;
    }

    const issuerNit = String(row[9] ?? '').trim();
    const issuerName = String(row[10] ?? '').trim();
    const receiverNit = String(row[11] ?? '').trim();
    const receiverName = String(row[12] ?? '').trim();

    const iva = parseDecimal(row[13]);
    const ica = parseDecimal(row[14]);
    const ic = parseDecimal(row[15]);
    const inc = parseDecimal(row[16]);
    const reteIva = parseDecimal(row[26]);
    const reteRenta = parseDecimal(row[27]);
    const reteIca = parseDecimal(row[28]);
    const total = parseDecimal(row[29]);
    const status = String(row[30] ?? '').trim() || null;
    const documentGroup = String(row[31] ?? '').trim() || null;

    const metaFields: Record<string, number> = {};
    if (ica !== 0) metaFields.ica = ica;
    if (ic !== 0) metaFields.ic = ic;
    if (inc !== 0) metaFields.inc = inc;
    if (reteIva !== 0) metaFields.rete_iva = reteIva;
    if (reteRenta !== 0) metaFields.rete_renta = reteRenta;
    if (reteIca !== 0) metaFields.rete_ica = reteIca;

    documents.push({
      cufe,
      number: folio,
      prefix,
      document_type: documentType,
      document_group: documentGroup,
      issue_date: issueDate,
      reception_date: receptionDate,
      issuer_nit: issuerNit,
      issuer_name: issuerName,
      receiver_nit: receiverNit,
      receiver_name: receiverName,
      amount: total,
      tax_amount: iva,
      currency,
      status,
      metadata: Object.keys(metaFields).length > 0 ? metaFields : null,
    });
  }

  let period = '';
  if (documents.length > 0) {
    period = documents[0].issue_date.substring(0, 7);
  }

  return { documents, skipped, warnings, period };
}
