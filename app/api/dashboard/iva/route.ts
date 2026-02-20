import { NextRequest, NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

// Fetch all rows handling Supabase 1000 row limit
async function fetchAllRows(
  table: string,
  select: string,
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

export const maxDuration = 60;

// =====================================================
// CALCULO ESTRICTO DE IVA — FORMULARIO 300 DIAN
// =====================================================
// Atelier Siete NIT: 901764924 — ultimo digito: 4
// Regimen cuatrimestral (ingresos < 92,000 UVT)
//
// FUENTES DE DATOS (solo documentos electronicos DIAN):
//   1. Facturas de Venta (FV) → IVA Generado
//   2. Notas Credito (NC) → Reduccion IVA Generado
//   3. Facturas de Compra (FC) → IVA Descontable
//
// NO se usan journals/comprobantes contables para IVA
// porque son el REFLEJO contable de las facturas (doble conteo).
// =====================================================

interface CuatrimestralPeriod {
  id: string;
  label: string;
  year: number;
  quarter: number;
  start_date: string;
  end_date: string;
  deadline: string;
  months: string[];
}

interface MonthIva {
  month: string;
  month_label: string;
  // IVA Generado
  iva_generado: number;
  base_ventas: number;
  invoices_count: number;
  // Notas Credito
  iva_nc: number;
  base_nc: number;
  cn_count: number;
  // IVA Descontable (compras)
  iva_descontable: number;
  base_compras: number;
  purchases_count: number;
  // Neto
  iva_neto: number;
}

interface PeriodData {
  period: CuatrimestralPeriod;
  // Renglones Formulario 300
  // Renglon 59: Total IVA generado por operaciones gravadas
  iva_generado: number;
  base_gravable_ventas: number;
  invoices_count: number;
  // Renglon 73: IVA resultante por devoluciones en ventas (NC)
  iva_notas_credito: number;
  base_nc: number;
  cn_count: number;
  // Renglon 80: Total impuestos descontables (IVA pagado en compras)
  iva_descontable: number;
  base_compras: number;
  purchases_count: number;
  // Renglon 82: Saldo a pagar por el periodo
  iva_neto: number;
  // Estado
  is_past_due: boolean;
  is_current: boolean;
  // Desglose mensual
  monthly: MonthIva[];
}

// Deadlines for NIT ending in 4 (cuatrimestral)
function getDeadline(year: number, quarter: number): string {
  // Fuente: Calendario tributario DIAN
  // NIT 901764924 — ultimo digito 4
  const deadlines: Record<string, string> = {
    '2024-1': '2024-05-14',
    '2024-2': '2024-09-11',
    '2024-3': '2025-01-15',
    '2025-1': '2025-05-14',
    '2025-2': '2025-09-11',
    '2025-3': '2026-01-15',
    '2026-1': '2026-05-15',
    '2026-2': '2026-09-14',
    '2026-3': '2027-01-18',
  };
  return deadlines[`${year}-${quarter}`] || `${quarter === 3 ? year + 1 : year}-${quarter === 1 ? '05' : quarter === 2 ? '09' : '01'}-15`;
}

function buildPeriods(year: number): CuatrimestralPeriod[] {
  const labels = ['Ene - Abr', 'May - Ago', 'Sep - Dic'];
  const startMonths = [1, 5, 9];
  const endMonths = [4, 8, 12];

  return [1, 2, 3].map((q) => {
    const sm = startMonths[q - 1];
    const em = endMonths[q - 1];
    const months: string[] = [];
    for (let m = sm; m <= em; m++) {
      months.push(`${year}-${String(m).padStart(2, '0')}`);
    }
    const lastDay = new Date(year, em, 0).getDate();
    return {
      id: `${year}-Q${q}`,
      label: `${labels[q - 1]} ${year}`,
      year,
      quarter: q,
      start_date: `${year}-${String(sm).padStart(2, '0')}-01`,
      end_date: `${year}-${String(em).padStart(2, '0')}-${lastDay}`,
      deadline: getDeadline(year, q),
      months,
    };
  });
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// GET /api/dashboard/iva?year=2025
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const yearParam = searchParams.get('year');
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear() - 1;

  try {
    const periods = buildPeriods(year);
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year + 1}-01-01`;

    // ==========================================
    // FUENTE 1: Facturas de Venta (IVA Generado)
    // Estas son facturas electronicas enviadas a DIAN
    // ==========================================
    const invoices = await fetchAllRows(
      'invoices',
      'date, subtotal, tax_amount, name',
      (q) => q.gte('date', yearStart).lt('date', yearEnd).eq('annulled', false)
    );

    // ==========================================
    // FUENTE 2: Notas Credito (Reducen IVA Generado)
    // Tambien son documentos electronicos en DIAN
    // ==========================================
    const creditNotes = await fetchAllRows(
      'credit_notes',
      'date, subtotal, tax_amount, name',
      (q) => q.gte('date', yearStart).lt('date', yearEnd)
    );

    // ==========================================
    // FUENTE 3: Facturas de Compra (IVA Descontable)
    // Facturas electronicas de proveedores registradas en DIAN
    // Usamos el campo tax_amount del HEADER (total IVA de la factura)
    // NO sumamos items individuales para evitar discrepancias
    // ==========================================
    const purchases = await fetchAllRows(
      'purchases',
      'date, subtotal, tax_amount, name, supplier_name',
      (q) => q.gte('date', yearStart).lt('date', yearEnd)
    );

    const today = new Date().toISOString().substring(0, 10);

    // --- Build period data ---
    const periodData: PeriodData[] = periods.map((period) => {
      const monthly: MonthIva[] = period.months.map((month) => {
        const mi = parseInt(month.split('-')[1]) - 1;

        // Facturas de venta del mes
        const monthInvoices = invoices.filter(
          (inv) => (inv.date as string)?.substring(0, 7) === month
        );
        const ivaGen = monthInvoices.reduce(
          (sum, inv) => sum + (Number(inv.tax_amount) || 0), 0
        );
        const baseVentas = monthInvoices.reduce(
          (sum, inv) => sum + (Number(inv.subtotal) || 0), 0
        );

        // Notas credito del mes
        const monthCn = creditNotes.filter(
          (cn) => (cn.date as string)?.substring(0, 7) === month
        );
        const ivaNc = monthCn.reduce(
          (sum, cn) => sum + (Number(cn.tax_amount) || 0), 0
        );
        const baseNc = monthCn.reduce(
          (sum, cn) => sum + (Number(cn.subtotal) || 0), 0
        );

        // Facturas de compra del mes
        const monthPurchases = purchases.filter(
          (p) => (p.date as string)?.substring(0, 7) === month
        );
        const ivaDesc = monthPurchases.reduce(
          (sum, p) => sum + (Number(p.tax_amount) || 0), 0
        );
        const baseCompras = monthPurchases.reduce(
          (sum, p) => sum + (Number(p.subtotal) || 0), 0
        );

        return {
          month,
          month_label: MONTH_NAMES[mi],
          iva_generado: ivaGen,
          base_ventas: baseVentas,
          invoices_count: monthInvoices.length,
          iva_nc: ivaNc,
          base_nc: baseNc,
          cn_count: monthCn.length,
          iva_descontable: ivaDesc,
          base_compras: baseCompras,
          purchases_count: monthPurchases.length,
          iva_neto: ivaGen - ivaNc - ivaDesc,
        };
      });

      // Period totals
      const iva_generado = monthly.reduce((s, m) => s + m.iva_generado, 0);
      const base_ventas = monthly.reduce((s, m) => s + m.base_ventas, 0);
      const inv_count = monthly.reduce((s, m) => s + m.invoices_count, 0);
      const iva_nc = monthly.reduce((s, m) => s + m.iva_nc, 0);
      const base_nc = monthly.reduce((s, m) => s + m.base_nc, 0);
      const cn_count = monthly.reduce((s, m) => s + m.cn_count, 0);
      const iva_desc = monthly.reduce((s, m) => s + m.iva_descontable, 0);
      const base_compras = monthly.reduce((s, m) => s + m.base_compras, 0);
      const purch_count = monthly.reduce((s, m) => s + m.purchases_count, 0);
      const iva_neto = iva_generado - iva_nc - iva_desc;

      return {
        period,
        iva_generado,
        base_gravable_ventas: base_ventas,
        invoices_count: inv_count,
        iva_notas_credito: iva_nc,
        base_nc,
        cn_count,
        iva_descontable: iva_desc,
        base_compras,
        purchases_count: purch_count,
        iva_neto,
        is_past_due: today > period.deadline,
        is_current: today >= period.start_date && today <= period.end_date,
        monthly,
      };
    });

    // Annual totals
    const annual = {
      iva_generado: periodData.reduce((s, p) => s + p.iva_generado, 0),
      base_gravable_ventas: periodData.reduce((s, p) => s + p.base_gravable_ventas, 0),
      invoices_count: periodData.reduce((s, p) => s + p.invoices_count, 0),
      iva_notas_credito: periodData.reduce((s, p) => s + p.iva_notas_credito, 0),
      base_nc: periodData.reduce((s, p) => s + p.base_nc, 0),
      cn_count: periodData.reduce((s, p) => s + p.cn_count, 0),
      iva_descontable: periodData.reduce((s, p) => s + p.iva_descontable, 0),
      base_compras: periodData.reduce((s, p) => s + p.base_compras, 0),
      purchases_count: periodData.reduce((s, p) => s + p.purchases_count, 0),
      iva_neto: periodData.reduce((s, p) => s + p.iva_neto, 0),
    };

    // Validation: verify IVA rate consistency
    const expectedIvaRate = annual.base_gravable_ventas > 0
      ? (annual.iva_generado / annual.base_gravable_ventas * 100)
      : 0;

    // Available years from all data
    const allYearSet = new Set<string>();
    invoices.forEach((i) => { const y = (i.date as string)?.substring(0, 4); if (y) allYearSet.add(y); });
    creditNotes.forEach((cn) => { const y = (cn.date as string)?.substring(0, 4); if (y) allYearSet.add(y); });
    purchases.forEach((p) => { const y = (p.date as string)?.substring(0, 4); if (y) allYearSet.add(y); });
    // Also check if other years exist
    const otherYearsInv = await fetchAllRows('invoices', 'date', (q) => q.eq('annulled', false));
    otherYearsInv.forEach((i) => { const y = (i.date as string)?.substring(0, 4); if (y) allYearSet.add(y); });
    const allYears = Array.from(allYearSet).sort();

    return NextResponse.json({
      year,
      nit: '901764924',
      razon_social: 'ATELIER SIETE SAS',
      regimen: 'Cuatrimestral',
      formulario: '300',
      ultimo_digito_nit: 4,
      periods: periodData,
      annual,
      available_years: allYears,
      validation: {
        tasa_iva_efectiva: Math.round(expectedIvaRate * 100) / 100,
        nota: expectedIvaRate > 18 && expectedIvaRate < 20
          ? 'Tasa IVA efectiva consistente (~19%)'
          : `Tasa IVA efectiva: ${expectedIvaRate.toFixed(1)}% — puede incluir productos exentos/excluidos`,
      },
      fuentes: {
        descripcion: 'Solo documentos electronicos registrados en DIAN',
        facturas_venta: invoices.length,
        notas_credito: creditNotes.length,
        facturas_compra: purchases.length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
