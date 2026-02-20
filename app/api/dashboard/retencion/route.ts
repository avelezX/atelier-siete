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
// RETENCION EN LA FUENTE + RENTA — FORMULARIOS 350 / 110
// =====================================================
// Atelier Siete NIT: 901764924 — ultimo digito: 4
//
// RETENCION EN LA FUENTE (F.350):
//   Periodicidad: Mensual
//   Fuente: purchase_items.retention_value (retenciones que Atelier
//   practica a proveedores al momento de pagarles)
//
// RENTA (F.110):
//   Periodicidad: Anual (dos cuotas)
//   Tarifa: 35% personas juridicas
//   Fuente: PyG basado en facturas, notas credito, journal_items,
//   purchase_items (misma logica del dashboard Resumen)
// =====================================================

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Monthly retention filing deadlines for NIT ending in 4
function getRetencionDeadline(year: number, month: number): string {
  const deadlines: Record<string, string> = {
    // 2024 deadlines (NIT digit 4)
    '2024-1': '2024-02-14', '2024-2': '2024-03-14', '2024-3': '2024-04-15',
    '2024-4': '2024-05-14', '2024-5': '2024-06-14', '2024-6': '2024-07-15',
    '2024-7': '2024-08-14', '2024-8': '2024-09-12', '2024-9': '2024-10-15',
    '2024-10': '2024-11-14', '2024-11': '2024-12-13', '2024-12': '2025-01-15',
    // 2025 deadlines (NIT digit 4)
    '2025-1': '2025-02-14', '2025-2': '2025-03-14', '2025-3': '2025-04-14',
    '2025-4': '2025-05-15', '2025-5': '2025-06-16', '2025-6': '2025-07-14',
    '2025-7': '2025-08-15', '2025-8': '2025-09-12', '2025-9': '2025-10-15',
    '2025-10': '2025-11-18', '2025-11': '2025-12-15', '2025-12': '2026-01-16',
  };
  const key = `${year}-${month}`;
  if (deadlines[key]) return deadlines[key];
  // Fallback: ~14th of next month
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-14`;
}

// Renta filing deadlines for NIT ending in 4 (2 installments)
function getRentaDeadlines(yearGravable: number): { cuota1: string; cuota2: string } {
  const deadlines: Record<number, { cuota1: string; cuota2: string }> = {
    2023: { cuota1: '2024-05-14', cuota2: '2024-07-12' },
    2024: { cuota1: '2025-05-15', cuota2: '2025-07-14' },
    2025: { cuota1: '2026-05-15', cuota2: '2026-07-14' },
  };
  return deadlines[yearGravable] || {
    cuota1: `${yearGravable + 1}-05-15`,
    cuota2: `${yearGravable + 1}-07-14`,
  };
}

interface RetentionDetail {
  purchase_name: string;
  supplier_name: string;
  date: string;
  base: number;
  percentage: number;
  retention_value: number;
  retention_name: string;
}

interface RetentionConcept {
  concept: string;
  total: number;
  items_count: number;
  avg_rate: number;
  details: RetentionDetail[];
}

interface MonthRetencion {
  month: string;
  month_label: string;
  deadline: string;
  is_past_due: boolean;
  total_retencion: number;
  purchases_count: number;
  by_concept: RetentionConcept[];
}

// GET /api/dashboard/retencion?year=2025
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const yearParam = searchParams.get('year');
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear() - 1;

  try {
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year + 1}-01-01`;
    const today = new Date().toISOString().substring(0, 10);

    // ==========================================
    // RETENCION EN LA FUENTE (Formulario 350)
    // ==========================================

    // Fetch purchase headers for date/supplier mapping
    const purchases = await fetchAllRows(
      'purchases',
      'id, date, name, supplier_name, retention_amount',
      (q) => q.gte('date', yearStart).lt('date', yearEnd)
    );

    const purchaseDateMap = new Map<string, string>();
    const purchaseNameMap = new Map<string, string>();
    const purchaseSupplierMap = new Map<string, string>();
    purchases.forEach((p) => {
      purchaseDateMap.set(p.id as string, (p.date as string) || '');
      purchaseNameMap.set(p.id as string, (p.name as string) || '');
      purchaseSupplierMap.set(p.id as string, (p.supplier_name as string) || '');
    });

    // Fetch purchase items with retention data
    const retentionItems = await fetchAllRows(
      'purchase_items',
      'purchase_id, price, quantity, retention_name, retention_percentage, retention_value',
      (q) => q.gt('retention_value', 0)
    );

    // Build monthly retention data
    const monthlyRetentionMap = new Map<string, RetentionDetail[]>();
    retentionItems.forEach((item) => {
      const purchaseId = item.purchase_id as string;
      const purchaseDate = purchaseDateMap.get(purchaseId);
      if (!purchaseDate) return;
      const month = purchaseDate.substring(0, 7);
      // Only include items for the requested year
      if (!month.startsWith(String(year))) return;

      const qty = Number(item.quantity) || 1;
      const base = (Number(item.price) || 0) * qty;

      const detail: RetentionDetail = {
        purchase_name: purchaseNameMap.get(purchaseId) || '',
        supplier_name: purchaseSupplierMap.get(purchaseId) || '',
        date: purchaseDate,
        base,
        percentage: Number(item.retention_percentage) || 0,
        retention_value: Number(item.retention_value) || 0,
        retention_name: (item.retention_name as string) || 'Retefuente',
      };

      if (!monthlyRetentionMap.has(month)) {
        monthlyRetentionMap.set(month, []);
      }
      monthlyRetentionMap.get(month)!.push(detail);
    });

    // Build monthly retention array (all 12 months)
    const monthlyRetencion: MonthRetencion[] = [];
    for (let m = 1; m <= 12; m++) {
      const month = `${year}-${String(m).padStart(2, '0')}`;
      const details = monthlyRetentionMap.get(month) || [];
      const deadline = getRetencionDeadline(year, m);

      // Group by retention concept
      const conceptMap = new Map<string, RetentionDetail[]>();
      details.forEach((d) => {
        const concept = d.retention_name;
        if (!conceptMap.has(concept)) conceptMap.set(concept, []);
        conceptMap.get(concept)!.push(d);
      });

      const byConcept: RetentionConcept[] = [];
      for (const [concept, items] of conceptMap) {
        const total = items.reduce((s, i) => s + i.retention_value, 0);
        const totalBase = items.reduce((s, i) => s + i.base, 0);
        byConcept.push({
          concept,
          total,
          items_count: items.length,
          avg_rate: totalBase > 0 ? (total / totalBase) * 100 : 0,
          details: items.sort((a, b) => b.retention_value - a.retention_value),
        });
      }
      byConcept.sort((a, b) => b.total - a.total);

      const totalRetencion = details.reduce((s, d) => s + d.retention_value, 0);
      const uniquePurchases = new Set(details.map((d) => d.purchase_name));

      monthlyRetencion.push({
        month,
        month_label: MONTH_NAMES[m - 1],
        deadline,
        is_past_due: today > deadline,
        total_retencion: totalRetencion,
        purchases_count: uniquePurchases.size,
        by_concept: byConcept,
      });
    }

    const retencionAnual = monthlyRetencion.reduce((s, m) => s + m.total_retencion, 0);

    // ==========================================
    // RENTA (Formulario 110)
    // ==========================================
    // PyG calculation — same logic as resumen dashboard

    // Invoices (revenue)
    const invoices = await fetchAllRows(
      'invoices',
      'date, subtotal, tax_amount',
      (q) => q.gte('date', yearStart).lt('date', yearEnd).eq('annulled', false)
    );

    // Credit notes (returns)
    const creditNotes = await fetchAllRows(
      'credit_notes',
      'date, total, subtotal, tax_amount',
      (q) => q.gte('date', yearStart).lt('date', yearEnd)
    );

    // Journal headers for date mapping
    const journals = await fetchAllRows('journals', 'id, date, name');
    const journalDateMap = new Map<string, string>();
    journals.forEach((j) => {
      journalDateMap.set(j.id as string, (j.date as string) || '');
    });

    // COGS from journals (6135xx Debit)
    const costoVentas = await fetchAllRows(
      'journal_items',
      'account_code, movement, value, journal_id',
      (q) => q.like('account_code', '6135%').eq('movement', 'Debit')
    );

    // Expenses from journals (5xxx Debit)
    const gastosJournal = await fetchAllRows(
      'journal_items',
      'account_code, movement, value, journal_id',
      (q) => q.like('account_code', '5%').eq('movement', 'Debit')
    );

    // Expenses from purchase items (5xxx)
    const gastosPurchase = await fetchAllRows(
      'purchase_items',
      'account_code, price, quantity, purchase_id',
      (q) => q.like('account_code', '5%')
    );

    // Calculate P&L totals for the year
    let ingresosBrutos = 0;
    let ivaGenerado = 0;
    invoices.forEach((inv) => {
      const d = (inv.date as string) || '';
      if (d >= yearStart && d < yearEnd) {
        ingresosBrutos += Number(inv.subtotal) || 0;
        ivaGenerado += Number(inv.tax_amount) || 0;
      }
    });

    let devoluciones = 0;
    creditNotes.forEach((cn) => {
      devoluciones += Number(cn.subtotal) || 0;
    });

    const ingresosNetos = ingresosBrutos - devoluciones;

    // COGS
    let costos = 0;
    costoVentas.forEach((item) => {
      const jDate = journalDateMap.get(item.journal_id as string);
      if (jDate && jDate >= yearStart && jDate < yearEnd) {
        costos += Number(item.value) || 0;
      }
    });

    const rentaBruta = ingresosNetos - costos;

    // Expenses (deducciones)
    let gastosAdmin = 0;
    let gastosVenta = 0;
    let gastosFinancieros = 0;

    gastosJournal.forEach((item) => {
      const jDate = journalDateMap.get(item.journal_id as string);
      if (!jDate || jDate < yearStart || jDate >= yearEnd) return;
      const val = Number(item.value) || 0;
      const code = item.account_code as string;
      if (code.startsWith('51')) gastosAdmin += val;
      else if (code.startsWith('52')) gastosVenta += val;
      else if (code.startsWith('53')) gastosFinancieros += val;
    });

    gastosPurchase.forEach((item) => {
      const pDate = purchaseDateMap.get(item.purchase_id as string);
      if (!pDate || pDate < yearStart || pDate >= yearEnd) return;
      const qty = Number(item.quantity) || 1;
      const val = (Number(item.price) || 0) * qty;
      const code = item.account_code as string;
      if (code.startsWith('51')) gastosAdmin += val;
      else if (code.startsWith('52')) gastosVenta += val;
      else if (code.startsWith('53')) gastosFinancieros += val;
    });

    const totalDeducciones = gastosAdmin + gastosVenta + gastosFinancieros;
    const rentaLiquida = rentaBruta - totalDeducciones;
    const baseGravable = Math.max(rentaLiquida, 0);

    const TARIFA_RENTA = 35; // 35% personas juridicas
    const impuestoRenta = baseGravable * (TARIFA_RENTA / 100);

    // Retenciones que le practicaron a Atelier (reduce el saldo a pagar)
    // Estas estan en journal_items cuenta 1355xx (Anticipo retenciones) — Credit side
    // or we can approximate from the retention data clients may have applied
    // For now, we note this as unknown since we don't have reliable data
    const retencionesQueLePracticaron = 0; // TODO: if data available

    const saldoAPagar = Math.max(impuestoRenta - retencionesQueLePracticaron, 0);
    const rentaDeadlines = getRentaDeadlines(year);

    // Available years
    const allYearSet = new Set<string>();
    invoices.forEach((i) => { const y = (i.date as string)?.substring(0, 4); if (y) allYearSet.add(y); });
    purchases.forEach((p) => { const y = (p.date as string)?.substring(0, 4); if (y) allYearSet.add(y); });
    const otherYearsInv = await fetchAllRows('invoices', 'date', (q) => q.eq('annulled', false));
    otherYearsInv.forEach((i) => { const y = (i.date as string)?.substring(0, 4); if (y) allYearSet.add(y); });
    const allYears = Array.from(allYearSet).sort();

    return NextResponse.json({
      year,
      nit: '901764924',
      razon_social: 'ATELIER SIETE SAS',
      ultimo_digito_nit: 4,
      available_years: allYears,

      // Retencion en la Fuente
      retencion: {
        formulario: '350',
        periodicidad: 'Mensual',
        monthly: monthlyRetencion,
        annual_total: retencionAnual,
        total_purchases_with_retention: retentionItems.length,
      },

      // Renta
      renta: {
        formulario: '110',
        tarifa: TARIFA_RENTA,
        deadlines: {
          cuota1: { label: '1a cuota (declaracion + 50%)', date: rentaDeadlines.cuota1 },
          cuota2: { label: '2a cuota (50% restante)', date: rentaDeadlines.cuota2 },
        },
        pyg: {
          ingresos_brutos: ingresosBrutos,
          devoluciones,
          ingresos_netos: ingresosNetos,
          costos,
          renta_bruta: rentaBruta,
          gastos_admin: gastosAdmin,
          gastos_venta: gastosVenta,
          gastos_financieros: gastosFinancieros,
          total_deducciones: totalDeducciones,
          renta_liquida: rentaLiquida,
        },
        base_gravable: baseGravable,
        impuesto_renta: impuestoRenta,
        retenciones_que_le_practicaron: retencionesQueLePracticaron,
        saldo_a_pagar: saldoAPagar,
        cuota1: Math.round(saldoAPagar / 2),
        cuota2: saldoAPagar - Math.round(saldoAPagar / 2),
        is_cuota1_past_due: today > rentaDeadlines.cuota1,
        is_cuota2_past_due: today > rentaDeadlines.cuota2,
      },

      fuentes: {
        descripcion: 'Datos de Siigo (facturas, notas credito, comprobantes, facturas de compra)',
        invoices: invoices.length,
        credit_notes: creditNotes.length,
        purchases: purchases.length,
        retention_items: retentionItems.length,
        journal_items_cogs: costoVentas.length,
        journal_items_expenses: gastosJournal.length,
        purchase_items_expenses: gastosPurchase.length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
