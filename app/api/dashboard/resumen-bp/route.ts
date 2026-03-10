import { NextRequest, NextResponse } from 'next/server';
import { fetchTestBalanceReport } from '@/lib/siigo';
import * as XLSX from 'xlsx';

export const maxDuration = 120;

// --- Excel parsing (same as comparar-balance) ---

interface BalanceAccount {
  code: string;
  account_name: string;
  mov_debit: number;
  mov_credit: number;
}

async function parseBalanceExcel(fileUrl: string): Promise<BalanceAccount[]> {
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) throw new Error(`Failed to download: ${fileRes.status}`);
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

  const accounts: BalanceAccount[] = [];
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
      account_name: name,
      mov_debit: nums[1] || 0,   // Saldo Inicial=0, Mov Débito=1
      mov_credit: nums[2] || 0,  // Mov Crédito=2, Saldo Final=3
    });
  }

  return accounts;
}

// Aggregate leaf accounts by prefix (no double-counting parents)
function aggregateLeaf(accounts: BalanceAccount[], prefix: string): { debit: number; credit: number; net: number } {
  const matching = accounts.filter(a => a.code.startsWith(prefix));
  let debit = 0;
  let credit = 0;

  for (const acc of matching) {
    const isLeaf = !matching.some(other => other.code !== acc.code && other.code.startsWith(acc.code));
    if (isLeaf) {
      debit += acc.mov_debit;
      credit += acc.mov_credit;
    }
  }

  return { debit, credit, net: debit - credit };
}

// Get 4-digit subcategory breakdown
function getSubcategories(accounts: BalanceAccount[], prefix2: string): { code: string; name: string; debit: number; credit: number; net: number }[] {
  // Find all unique 4-digit prefixes
  const prefixes4 = new Set<string>();
  for (const acc of accounts) {
    if (acc.code.startsWith(prefix2) && acc.code.length >= 4) {
      prefixes4.add(acc.code.substring(0, 4));
    }
  }

  const result: { code: string; name: string; debit: number; credit: number; net: number }[] = [];
  for (const p4 of Array.from(prefixes4).sort()) {
    const agg = aggregateLeaf(accounts, p4);
    if (agg.debit > 0 || agg.credit > 0) {
      // Find name from the 4-digit account or its first child
      const nameAcc = accounts.find(a => a.code === p4) || accounts.find(a => a.code.startsWith(p4));
      result.push({
        code: p4,
        name: nameAcc?.account_name || p4,
        ...agg,
      });
    }
  }
  return result;
}

// --- Main handler ---

interface MonthPyG {
  month: string;
  ventas_brutas: number;     // 41xx credit (gross revenue)
  devoluciones: number;      // 41xx debit (returns/NC)
  ventas_netas: number;      // credit - debit on 41
  otros_ingresos: number;    // 42xx net credit
  costo_ventas: number;      // 61xx net debit
  utilidad_bruta: number;
  margen_bruto_pct: number;
  gastos_admin: number;      // 51xx net debit
  gastos_venta: number;      // 52xx net debit
  gastos_financieros: number; // 53xx net debit
  total_gastos: number;
  utilidad_operativa: number;
  // Subcategory detail (4-digit)
  subcats_51: { code: string; name: string; net: number }[];
  subcats_52: { code: string; name: string; net: number }[];
  subcats_53: { code: string; name: string; net: number }[];
  subcats_61: { code: string; name: string; net: number }[];
}

export async function GET(req: NextRequest) {
  try {
    const year = parseInt(req.nextUrl.searchParams.get('year') || '2025');

    const months: MonthPyG[] = [];
    const errors: string[] = [];

    // Fetch each month sequentially (Siigo caches prevent parallel)
    for (let m = 1; m <= 12; m++) {
      try {
        const report = await fetchTestBalanceReport(year, m, m);
        if (!report.file_url) {
          errors.push(`Mes ${m}: sin file_url`);
          months.push(emptyMonth(year, m));
          continue;
        }

        const accounts = await parseBalanceExcel(report.file_url);

        // Revenue: 41xx — credit = gross sales, debit = returns/NC
        const rev41 = aggregateLeaf(accounts, '41');
        const ventas_brutas = rev41.credit;
        const devoluciones = rev41.debit;
        const ventas_netas = rev41.credit - rev41.debit;

        // Other income: 42xx
        const rev42 = aggregateLeaf(accounts, '42');
        const otros_ingresos = rev42.credit - rev42.debit;

        // COGS: 61xx (debit - credit = net cost)
        const cogs61 = aggregateLeaf(accounts, '61');
        const costo_ventas = cogs61.net;

        const utilidad_bruta = ventas_netas - costo_ventas;

        // Expenses
        const exp51 = aggregateLeaf(accounts, '51');
        const exp52 = aggregateLeaf(accounts, '52');
        const exp53 = aggregateLeaf(accounts, '53');

        const gastos_admin = exp51.net;
        const gastos_venta = exp52.net;
        const gastos_financieros = exp53.net;
        const total_gastos = gastos_admin + gastos_venta + gastos_financieros;

        const utilidad_operativa = utilidad_bruta - total_gastos;

        // Subcategory detail
        const subcats_51 = getSubcategories(accounts, '51').map(s => ({ code: s.code, name: s.name, net: s.net }));
        const subcats_52 = getSubcategories(accounts, '52').map(s => ({ code: s.code, name: s.name, net: s.net }));
        const subcats_53 = getSubcategories(accounts, '53').map(s => ({ code: s.code, name: s.name, net: s.net }));
        const subcats_61 = getSubcategories(accounts, '61').map(s => ({ code: s.code, name: s.name, net: s.net }));

        months.push({
          month: `${year}-${String(m).padStart(2, '0')}`,
          ventas_brutas: Math.round(ventas_brutas),
          devoluciones: Math.round(devoluciones),
          ventas_netas: Math.round(ventas_netas),
          otros_ingresos: Math.round(otros_ingresos),
          costo_ventas: Math.round(costo_ventas),
          utilidad_bruta: Math.round(utilidad_bruta),
          margen_bruto_pct: ventas_netas > 0 ? Math.round((utilidad_bruta / ventas_netas) * 1000) / 10 : 0,
          gastos_admin: Math.round(gastos_admin),
          gastos_venta: Math.round(gastos_venta),
          gastos_financieros: Math.round(gastos_financieros),
          total_gastos: Math.round(total_gastos),
          utilidad_operativa: Math.round(utilidad_operativa),
          subcats_51,
          subcats_52,
          subcats_53,
          subcats_61,
        });
      } catch (e: unknown) {
        errors.push(`Mes ${m}: ${e instanceof Error ? e.message : String(e)}`);
        months.push(emptyMonth(year, m));
      }

      // Delay between calls
      if (m < 12) await new Promise(r => setTimeout(r, 500));
    }

    // Calculate totals
    const totals = months.reduce(
      (acc, m) => ({
        ventas_brutas: acc.ventas_brutas + m.ventas_brutas,
        devoluciones: acc.devoluciones + m.devoluciones,
        ventas_netas: acc.ventas_netas + m.ventas_netas,
        otros_ingresos: acc.otros_ingresos + m.otros_ingresos,
        costo_ventas: acc.costo_ventas + m.costo_ventas,
        utilidad_bruta: acc.utilidad_bruta + m.utilidad_bruta,
        gastos_admin: acc.gastos_admin + m.gastos_admin,
        gastos_venta: acc.gastos_venta + m.gastos_venta,
        gastos_financieros: acc.gastos_financieros + m.gastos_financieros,
        total_gastos: acc.total_gastos + m.total_gastos,
        utilidad_operativa: acc.utilidad_operativa + m.utilidad_operativa,
      }),
      {
        ventas_brutas: 0, devoluciones: 0, ventas_netas: 0, otros_ingresos: 0,
        costo_ventas: 0, utilidad_bruta: 0,
        gastos_admin: 0, gastos_venta: 0, gastos_financieros: 0,
        total_gastos: 0, utilidad_operativa: 0,
      }
    );

    const margen_bruto_pct = totals.ventas_netas > 0
      ? Math.round((totals.utilidad_bruta / totals.ventas_netas) * 1000) / 10
      : 0;

    // Aggregate subcategories across all months
    const allSubcats = (prefix: string) => {
      const map = new Map<string, { name: string; net: number }>();
      const key = `subcats_${prefix}` as keyof MonthPyG;
      for (const m of months) {
        const subs = m[key] as { code: string; name: string; net: number }[];
        for (const s of subs) {
          const existing = map.get(s.code);
          if (existing) {
            existing.net += s.net;
          } else {
            map.set(s.code, { name: s.name, net: s.net });
          }
        }
      }
      return Array.from(map.entries())
        .map(([code, data]) => ({ code, name: data.name, net: Math.round(data.net) }))
        .sort((a, b) => b.net - a.net);
    };

    // === ANNUAL VERIFICATION ===
    // Fetch the annual BP (month 1-12) and compare using SAME leaf-only logic
    let annualVerification: Record<string, unknown> | undefined;
    try {
      const annualReport = await fetchTestBalanceReport(year, 1, 12);
      if (annualReport.file_url) {
        const annualAccounts = await parseBalanceExcel(annualReport.file_url);
        const aRev41 = aggregateLeaf(annualAccounts, '41');
        const aRev42 = aggregateLeaf(annualAccounts, '42');
        const aCogs61 = aggregateLeaf(annualAccounts, '61');
        const aExp51 = aggregateLeaf(annualAccounts, '51');
        const aExp52 = aggregateLeaf(annualAccounts, '52');
        const aExp53 = aggregateLeaf(annualAccounts, '53');

        const annualData = {
          ventas_brutas: Math.round(aRev41.credit),
          devoluciones: Math.round(aRev41.debit),
          ventas_netas: Math.round(aRev41.credit - aRev41.debit),
          otros_ingresos: Math.round(aRev42.credit - aRev42.debit),
          costo_ventas: Math.round(aCogs61.net),
          gastos_admin: Math.round(aExp51.net),
          gastos_venta: Math.round(aExp52.net),
          gastos_financieros: Math.round(aExp53.net),
          total_gastos: Math.round(aExp51.net + aExp52.net + aExp53.net),
          utilidad_bruta: Math.round((aRev41.credit - aRev41.debit) - aCogs61.net),
          utilidad_operativa: Math.round((aRev41.credit - aRev41.debit) - aCogs61.net - aExp51.net - aExp52.net - aExp53.net),
          accounts_parsed: annualAccounts.length,
        };

        // How many accounts per prefix in the annual BP
        const accountCounts: Record<string, { total: number; leaves: number }> = {};
        for (const prefix of ['41', '42', '51', '52', '53', '61']) {
          const matching = annualAccounts.filter(a => a.code.startsWith(prefix));
          const leaves = matching.filter(acc => !matching.some(other => other.code !== acc.code && other.code.startsWith(acc.code)));
          accountCounts[prefix] = { total: matching.length, leaves: leaves.length };
        }

        annualVerification = {
          annual_bp: annualData,
          monthly_sum: {
            ventas_brutas: totals.ventas_brutas,
            devoluciones: totals.devoluciones,
            ventas_netas: totals.ventas_netas,
            otros_ingresos: totals.otros_ingresos,
            costo_ventas: totals.costo_ventas,
            gastos_admin: totals.gastos_admin,
            gastos_venta: totals.gastos_venta,
            gastos_financieros: totals.gastos_financieros,
            total_gastos: totals.total_gastos,
            utilidad_bruta: totals.utilidad_bruta,
            utilidad_operativa: totals.utilidad_operativa,
          },
          diff: {
            ventas_brutas: Math.round(totals.ventas_brutas - annualData.ventas_brutas),
            devoluciones: Math.round(totals.devoluciones - annualData.devoluciones),
            ventas_netas: Math.round(totals.ventas_netas - annualData.ventas_netas),
            costo_ventas: Math.round(totals.costo_ventas - annualData.costo_ventas),
            gastos_admin: Math.round(totals.gastos_admin - annualData.gastos_admin),
            gastos_venta: Math.round(totals.gastos_venta - annualData.gastos_venta),
            gastos_financieros: Math.round(totals.gastos_financieros - annualData.gastos_financieros),
            utilidad_operativa: Math.round(totals.utilidad_operativa - annualData.utilidad_operativa),
          },
          account_counts: accountCounts,
        };
      }
    } catch (e: unknown) {
      errors.push(`Verificación anual: ${e instanceof Error ? e.message : String(e)}`);
    }

    return NextResponse.json({
      year,
      source: 'Balance de Prueba Siigo',
      errors: errors.length > 0 ? errors : undefined,
      months,
      totals: { ...totals, margen_bruto_pct },
      subcats_totals: {
        '51': allSubcats('51'),
        '52': allSubcats('52'),
        '53': allSubcats('53'),
        '61': allSubcats('61'),
      },
      annual_verification: annualVerification,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function emptyMonth(year: number, m: number): MonthPyG {
  return {
    month: `${year}-${String(m).padStart(2, '0')}`,
    ventas_brutas: 0, devoluciones: 0, ventas_netas: 0, otros_ingresos: 0,
    costo_ventas: 0, utilidad_bruta: 0, margen_bruto_pct: 0,
    gastos_admin: 0, gastos_venta: 0, gastos_financieros: 0,
    total_gastos: 0, utilidad_operativa: 0,
    subcats_51: [], subcats_52: [], subcats_53: [], subcats_61: [],
  };
}
