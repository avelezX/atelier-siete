'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Wrench,
  RefreshCw,
  Search,
  BookOpen,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingDown,
  Info,
  Check,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import JournalModal from '@/components/JournalModal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MonthOverview {
  month: string;
  invoice_count: number;
  revenue: number;
  cogs_recorded: number;
  cogs_pct: number;
  cogs_gap: number;
  status: 'ok' | 'low' | 'none' | 'empty';
}

interface ProductRow {
  product_code: string;
  product_name: string;
  supplier_name: string;
  sale_price: number;
  sale_month: string;
  quantity_sold: number;
  revenue: number;
  cost_source: 'historical' | 'purchase' | 'journal' | 'none';
  historical_ratio: number | null; // as percentage (e.g., 64.3)
  estimated_cost: number;
  journal_cost: number;
}

interface CorrectionData {
  month_overview: MonthOverview[];
  historical_stats: {
    good_months: string[];
    products_with_ratio: number;
    avg_ratio: number;
  };
  products: ProductRow[];
  summary: {
    total_revenue: number;
    cogs_recorded: number;
    cogs_estimated_missing: number;
    products_with_historical: number;
    products_no_cost: number;
    products_with_journal: number;
  };
  problem_months: string[];
  active_month_filter: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
};

function formatMonth(ym: string): string {
  const [y, m] = ym.split('-');
  return `${MONTH_NAMES[m] || m} ${y}`;
}

function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
}

function rowKey(p: ProductRow): string {
  return `${p.product_code}::${p.sale_month}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CorreccionCostosPage() {
  const [data, setData] = useState<CorrectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startMonth, setStartMonth] = useState('2025-01');
  const [endMonth, setEndMonth] = useState('2026-02');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [costOverrides, setCostOverrides] = useState<Record<string, number>>({});
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showGuideWhat, setShowGuideWhat] = useState(true);
  const [showGuideManual, setShowGuideManual] = useState(true);
  const [showGuideTool, setShowGuideTool] = useState(false);
  const [showJournalSection, setShowJournalSection] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const monthParam = selectedMonth ? `&month_filter=${selectedMonth}` : '';
      const res = await fetch(
        `/api/dashboard/correccion-costos?start=${startMonth}&end=${endMonth}${monthParam}`
      );
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setSelected(new Set());
      setCostOverrides({});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [startMonth, endMonth, selectedMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Selection helpers ──────────────────────────────────────────────────────
  function toggle(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll(rows: ProductRow[]) {
    const keys = rows.map(rowKey);
    const allSel = keys.every(k => selected.has(k));
    setSelected(prev => {
      const next = new Set(prev);
      keys.forEach(k => allSel ? next.delete(k) : next.add(k));
      return next;
    });
  }

  function selectAll(rows: ProductRow[]) {
    setSelected(prev => {
      const next = new Set(prev);
      rows.forEach(p => next.add(rowKey(p)));
      return next;
    });
  }

  function getEffectiveCost(p: ProductRow): number {
    const key = rowKey(p);
    if (costOverrides[key] !== undefined) return costOverrides[key];
    return p.estimated_cost;
  }

  // ── Derived data ───────────────────────────────────────────────────────────
  const allProducts = data?.products || [];
  const histRows    = allProducts.filter(p => p.cost_source === 'historical');
  const noneRows    = allProducts.filter(p => p.cost_source === 'none');
  const journalRows = allProducts.filter(p => p.cost_source === 'journal');

  const suppliers = data
    ? [...new Set(allProducts.map(p => p.supplier_name))].filter(Boolean).sort()
    : [];

  const applyFilters = (list: ProductRow[]) =>
    list.filter(p => {
      if (supplierFilter !== 'all' && p.supplier_name !== supplierFilter) return false;
      if (searchTerm) {
        const t = searchTerm.toLowerCase();
        return (
          p.product_code.toLowerCase().includes(t) ||
          p.product_name.toLowerCase().includes(t) ||
          p.supplier_name.toLowerCase().includes(t)
        );
      }
      return true;
    });

  const filteredHist    = applyFilters(histRows);
  const filteredNone    = applyFilters(noneRows);
  const filteredJournal = applyFilters(journalRows);

  // Selected products for journal creation
  const selectedMonths = new Set<string>();
  const selectedForJournal = allProducts
    .filter(p => selected.has(rowKey(p)) && p.cost_source !== 'journal')
    .map(p => {
      selectedMonths.add(p.sale_month);
      return {
        product_code: p.product_code,
        product_name: p.product_name,
        estimated_cost: getEffectiveCost(p),
        quantity_sold: p.quantity_sold,
        status: p.cost_source === 'historical' ? 'historical' : 'missing',
        sale_month: p.sale_month,
      };
    });

  const s = data?.summary;

  // ── Status config ──────────────────────────────────────────────────────────
  function statusBadge(status: MonthOverview['status'], pct: number) {
    if (status === 'ok') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
        <CheckCircle className="w-3 h-3" /> {pct.toFixed(0)}% ok
      </span>
    );
    if (status === 'low') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
        <Clock className="w-3 h-3" /> {pct.toFixed(0)}% bajo
      </span>
    );
    if (status === 'none') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">
        <AlertTriangle className="w-3 h-3" /> {pct.toFixed(0)}% sin COGS
      </span>
    );
    return <span className="text-xs text-gray-400">— sin ventas</span>;
  }

  function monthRowBg(status: MonthOverview['status'], isSelected: boolean): string {
    if (isSelected) return 'bg-amber-100 border-l-4 border-amber-500';
    if (status === 'ok')   return 'bg-green-50/50 hover:bg-green-50';
    if (status === 'low')  return 'bg-amber-50/50 hover:bg-amber-50';
    if (status === 'none') return 'bg-red-50/50 hover:bg-red-50';
    return 'hover:bg-gray-50';
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
            <Wrench className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Corrección de Costos 2025–2026</h1>
            <p className="text-sm text-gray-500">
              Diagnóstico y corrección de COGS faltante — identifica meses y productos que necesitan comprobante contable
            </p>
          </div>
        </div>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => setShowJournalModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium"
          >
            <BookOpen className="w-4 h-4" />
            Crear Comprobante ({selected.size} productos, {selectedMonths.size} mes{selectedMonths.size !== 1 ? 'es' : ''})
          </button>
        )}
      </div>

      {/* ── Summary cards ── */}
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Revenue analizado</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(s.total_revenue)}</p>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-200 p-4">
            <div className="flex items-center gap-1 mb-1">
              <TrendingDown className="w-3 h-3 text-red-600" />
              <p className="text-xs text-red-700">COGS estimado faltante</p>
            </div>
            <p className="text-xl font-bold text-red-700">{formatCurrency(s.cogs_estimated_missing)}</p>
          </div>
          <div className="bg-green-50 rounded-xl border border-green-200 p-4">
            <p className="text-xs text-green-700 mb-1">Con historial de costo</p>
            <p className="text-xl font-bold text-green-700">{s.products_with_historical}</p>
            <p className="text-xs text-green-600">productos (estimación confiable)</p>
          </div>
          <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
            <p className="text-xs text-orange-700 mb-1">Sin historial — manual</p>
            <p className="text-xl font-bold text-orange-700">{s.products_no_cost}</p>
            <p className="text-xs text-orange-600">productos (necesitan costo real)</p>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
      )}

      {/* ── Tabla Diagnóstico de Meses ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">
            Diagnóstico por Mes
            {selectedMonth && (
              <span className="ml-2 text-amber-600">— filtrando por {formatMonth(selectedMonth)}</span>
            )}
          </h2>
          <div className="flex items-center gap-3">
            {selectedMonth && (
              <button
                type="button"
                onClick={() => setSelectedMonth(null)}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Ver todos los meses
              </button>
            )}
            <span className="text-xs text-gray-500">Click en un mes para filtrar productos</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Mes</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Facturas</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">COGS Reg.</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Brecha Est.</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data?.month_overview || []).map(m => (
                <tr
                  key={m.month}
                  className={`cursor-pointer transition-colors ${monthRowBg(m.status, selectedMonth === m.month)}`}
                  onClick={() => setSelectedMonth(prev => prev === m.month ? null : m.month)}
                >
                  <td className="px-4 py-2 font-medium text-gray-900">{formatMonth(m.month)}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{m.invoice_count || '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-900">
                    {m.revenue > 0 ? formatCurrency(m.revenue) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700">
                    {m.cogs_recorded > 0 ? formatCurrency(m.cogs_recorded) : m.revenue > 0 ? <span className="text-red-500 font-medium">$0</span> : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-red-600 font-medium">
                    {m.cogs_gap > 0 ? formatCurrency(m.cogs_gap) : m.status === 'ok' ? '—' : ''}
                  </td>
                  <td className="px-3 py-2 text-center">{statusBadge(m.status, m.cogs_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Guía de Corrección ── */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 overflow-hidden mb-6">
        <button
          type="button"
          onClick={() => setShowGuide(!showGuide)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-blue-800">Guía de Corrección Contable</h2>
            <span className="text-xs text-blue-600">— Qué pasó, cómo corregir en Siigo manualmente, y qué hace esta herramienta</span>
          </div>
          {showGuide
            ? <ChevronDown className="w-4 h-4 text-blue-500" />
            : <ChevronRight className="w-4 h-4 text-blue-500" />}
        </button>

        {showGuide && (
          <div className="border-t border-blue-200 divide-y divide-blue-100">

            {/* Sub-sección 1: Qué pasó */}
            <div>
              <button
                type="button"
                onClick={() => setShowGuideWhat(!showGuideWhat)}
                className="w-full px-6 py-3 flex items-center justify-between hover:bg-blue-50 transition-colors text-left"
              >
                <span className="text-sm font-medium text-blue-800">📊 ¿Qué pasó contablemente?</span>
                {showGuideWhat ? <ChevronDown className="w-3 h-3 text-blue-400" /> : <ChevronRight className="w-3 h-3 text-blue-400" />}
              </button>
              {showGuideWhat && (
                <div className="px-6 pb-4 space-y-3 text-sm text-blue-900">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="font-semibold text-green-800 mb-2">✅ Método correcto (Ene–Ago 2025)</p>
                      <p className="text-xs text-green-700 font-mono mb-1">Por cada producto vendido:</p>
                      <div className="font-mono text-xs space-y-1 text-green-900">
                        <div className="flex gap-2"><span className="text-red-600 w-14">Débito</span><span>6135XXXX (Costo de Ventas)</span></div>
                        <div className="flex gap-2"><span className="text-green-600 w-14">Crédito</span><span>1435XXXX (Inventario)</span></div>
                      </div>
                      <p className="text-xs text-green-600 mt-2">→ El costo baja del inventario y se registra en el P&L</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="font-semibold text-red-800 mb-2">❌ Método incorrecto (desde Sep 2025)</p>
                      <p className="text-xs text-red-700 font-mono mb-1">Solo se registraron entradas de inventario:</p>
                      <div className="font-mono text-xs space-y-1 text-red-900">
                        <div className="flex gap-2"><span className="text-red-600 w-14">Débito</span><span>1498XXXX (Inventario recibido)</span></div>
                        <div className="flex gap-2"><span className="text-green-600 w-14">Crédito</span><span>99999999 (Cuenta puente)</span></div>
                      </div>
                      <p className="text-xs text-red-600 mt-2">→ Las ventas aparecen sin ningún costo en el P&L</p>
                    </div>
                  </div>
                  <p className="text-blue-700 bg-blue-100 rounded p-2 text-xs">
                    <strong>Impacto:</strong> El margen bruto aparece artificialmente alto. Los meses afectados muestran 0% de COGS registrado
                    sobre millones en revenue. Los costos reales de mercancía no están siendo descontados del inventario ni reconocidos en pérdidas y ganancias.
                  </p>
                </div>
              )}
            </div>

            {/* Sub-sección 2: Cómo hacerlo en Siigo */}
            <div>
              <button
                type="button"
                onClick={() => setShowGuideManual(!showGuideManual)}
                className="w-full px-6 py-3 flex items-center justify-between hover:bg-blue-50 transition-colors text-left"
              >
                <span className="text-sm font-medium text-blue-800">📝 Cómo corregirlo en Siigo manualmente (paso a paso)</span>
                {showGuideManual ? <ChevronDown className="w-3 h-3 text-blue-400" /> : <ChevronRight className="w-3 h-3 text-blue-400" />}
              </button>
              {showGuideManual && (
                <div className="px-6 pb-4 text-sm text-blue-900">
                  <ol className="space-y-3">
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                      <div>
                        <p className="font-medium">Ir a Siigo → Contabilidad → Comprobantes Contables → Nuevo</p>
                        <p className="text-xs text-blue-700">Seleccionar tipo de documento <strong>CC</strong> (Comprobante de Contabilidad)</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                      <div>
                        <p className="font-medium">Poner la fecha del último día del mes que se corrige</p>
                        <p className="text-xs text-blue-700">Ej: para corregir enero 2026 → fecha <strong>31 de enero de 2026</strong></p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                      <div>
                        <p className="font-medium">Por cada producto vendido ese mes, agregar dos líneas:</p>
                        <div className="mt-1 bg-white border border-blue-200 rounded p-2 font-mono text-xs space-y-1">
                          <div className="flex gap-4">
                            <span className="text-red-600 w-16">DÉBITO</span>
                            <span>613505XX</span>
                            <span className="text-gray-500">(Costo de Ventas — Mercancías)</span>
                            <span className="font-bold">= costo total</span>
                          </div>
                          <div className="flex gap-4">
                            <span className="text-green-600 w-16">CRÉDITO</span>
                            <span>143505XX</span>
                            <span className="text-gray-500">(Inventarios — Mercancías)</span>
                            <span className="font-bold">= mismo valor</span>
                          </div>
                        </div>
                        <p className="text-xs text-blue-600 mt-1">El costo total = precio unitario × cantidad vendida en ese mes</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
                      <div>
                        <p className="font-medium">En el campo Observaciones escribir:</p>
                        <p className="font-mono text-xs bg-white border border-blue-200 rounded px-2 py-1 mt-1">
                          COGS [Mes Año] — Corrección costos de ventas
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">5</span>
                      <div>
                        <p className="font-medium">Guardar y verificar que el comprobante quede en estado Activo</p>
                        <p className="text-xs text-blue-700">Repetir para cada mes que aparece con ❌ en la tabla de diagnóstico</p>
                      </div>
                    </li>
                  </ol>
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
                    <strong>⚠️ Nota importante:</strong> Las subcuentas exactas (61350501, 14350101, etc.) dependen del grupo contable de cada producto.
                    Confirmar con la contadora las subcuentas correctas para cada categoría antes de crear los comprobantes.
                    Las cuentas que usa esta herramienta por defecto son 61350501 y 14350101.
                  </div>
                </div>
              )}
            </div>

            {/* Sub-sección 3: Qué hace esta herramienta */}
            <div>
              <button
                type="button"
                onClick={() => setShowGuideTool(!showGuideTool)}
                className="w-full px-6 py-3 flex items-center justify-between hover:bg-blue-50 transition-colors text-left"
              >
                <span className="text-sm font-medium text-blue-800">🔧 ¿Qué hace esta herramienta?</span>
                {showGuideTool ? <ChevronDown className="w-3 h-3 text-blue-400" /> : <ChevronRight className="w-3 h-3 text-blue-400" />}
              </button>
              {showGuideTool && (
                <div className="px-6 pb-4 text-sm text-blue-900 space-y-2">
                  <p>Esta herramienta automatiza el proceso anterior usando los datos de Siigo:</p>
                  <ol className="space-y-1 text-xs list-decimal list-inside text-blue-800">
                    <li>Identifica qué meses tienen COGS faltante comparando facturas vs comprobantes 6135</li>
                    <li>Para productos <strong>con historial</strong> (Ene–Ago 2025): calcula el ratio costo/venta de ese período y lo aplica a las ventas actuales</li>
                    <li>Para productos <strong>sin historial</strong> (muebles, productos nuevos): usa 70% del precio de venta como estimación fallback</li>
                    <li>Permite ajustar el costo manualmente para cada producto antes de crear el comprobante</li>
                    <li>Crea los comprobantes en Siigo con un clic, agrupando por mes de venta</li>
                  </ol>
                  <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-800 mt-2">
                    <strong>⚠️ Los costos estimados son aproximaciones.</strong> La contadora debe revisar y ajustar los valores,
                    especialmente para muebles y productos sin historial de COGS, antes de aprobar los comprobantes.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Desde</label>
          <input
            type="text"
            placeholder="2025-01"
            value={startMonth}
            onChange={e => setStartMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Hasta</label>
          <input
            type="text"
            placeholder="2026-02"
            value={endMonth}
            onChange={e => setEndMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28"
          />
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Cargar
        </button>
        <div className="flex-1" />
        <div className="relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar producto, código..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <select
          title="Filtrar por proveedor"
          value={supplierFilter}
          onChange={e => setSupplierFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">Todos los proveedores</option>
          {suppliers.map(sup => (
            <option key={sup} value={sup}>{sup}</option>
          ))}
        </select>
      </div>

      {loading && !data ? (
        <div className="text-center py-12 text-gray-500">Cargando datos de Siigo y Supabase...</div>
      ) : data ? (
        <>
          {selectedMonth && (
            <div className="mb-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              Mostrando productos de <strong>{formatMonth(selectedMonth)}</strong> únicamente.{' '}
              <button
                type="button"
                onClick={() => setSelectedMonth(null)}
                className="underline hover:no-underline ml-1"
              >
                Ver todos los meses problemáticos
              </button>
            </div>
          )}

          {/* ── Sección 1: Con historial de costo ── */}
          <div className="bg-white rounded-xl border border-green-300 overflow-hidden mb-6">
            <div className="px-4 py-3 bg-green-50 border-b border-green-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <h2 className="text-sm font-semibold text-green-800">
                  Con Historial de Costo ({filteredHist.length} productos)
                </h2>
                <span className="text-xs text-green-600 hidden md:inline">
                  — Ratio calculado de comprobantes Ene–Ago 2025. Costo estimado confiable, revisar antes de crear.
                </span>
              </div>
              <button
                type="button"
                onClick={() => selectAll(filteredHist)}
                className="px-3 py-1 text-xs text-green-700 border border-green-300 rounded-lg hover:bg-green-100"
              >
                Seleccionar todos
              </button>
            </div>
            {filteredHist.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="w-8 px-3 py-2">
                        <input
                          type="checkbox"
                          title="Seleccionar todos"
                          checked={filteredHist.length > 0 && filteredHist.every(p => selected.has(rowKey(p)))}
                          onChange={() => toggleAll(filteredHist)}
                          className="rounded border-gray-300"
                        />
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Mes</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Código</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Producto</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Proveedor</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Qty</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">P.Venta</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-green-700 uppercase">Ratio%</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-amber-700 uppercase">Costo Est.</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredHist.map(p => {
                      const key = rowKey(p);
                      const isSelected = selected.has(key);
                      const current = costOverrides[key] ?? p.estimated_cost;
                      const isModified = current !== p.estimated_cost;
                      return (
                        <tr key={key} className={`hover:bg-gray-50 ${isSelected ? 'bg-green-50/40' : ''}`}>
                          <td className="px-3 py-1.5 text-center">
                            <input
                              type="checkbox"
                              title={`Seleccionar ${p.product_code}`}
                              checked={isSelected}
                              onChange={() => toggle(key)}
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-xs font-medium text-gray-600">{formatMonth(p.sale_month)}</td>
                          <td className="px-3 py-1.5 font-mono text-xs text-gray-600">{p.product_code}</td>
                          <td className="px-3 py-1.5 text-gray-900 truncate max-w-[180px]" title={p.product_name}>{p.product_name}</td>
                          <td className="px-3 py-1.5 text-gray-500 text-xs">{p.supplier_name || '—'}</td>
                          <td className="px-3 py-1.5 text-right text-gray-700">{p.quantity_sold}</td>
                          <td className="px-3 py-1.5 text-right text-gray-700">{formatCurrency(p.sale_price)}</td>
                          <td className="px-3 py-1.5 text-right">
                            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded font-mono">
                              {p.historical_ratio?.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-1 py-1 text-right">
                            <input
                              type="number"
                              title={`Costo estimado para ${p.product_code}`}
                              value={current}
                              onChange={e => setCostOverrides(prev => ({ ...prev, [key]: Math.round(Number(e.target.value) || 0) }))}
                              className={`w-32 text-right px-2 py-1 text-sm border rounded-md font-mono
                                ${isModified
                                  ? 'border-amber-400 bg-amber-50 text-amber-900 font-medium'
                                  : 'border-gray-200 text-gray-900'
                                } focus:ring-1 focus:ring-amber-500 focus:border-amber-500`}
                              min={0}
                            />
                          </td>
                          <td className="px-3 py-1.5 text-right text-gray-900 font-medium">{formatCurrency(p.revenue)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-4 py-6 text-center text-gray-400 text-sm">
                {histRows.length === 0
                  ? 'No hay productos con historial de costo en este período'
                  : 'No hay resultados con los filtros actuales'}
              </p>
            )}
          </div>

          {/* ── Sección 2: Sin historial — necesitan costo manual ── */}
          <div className="bg-white rounded-xl border border-orange-300 overflow-hidden mb-6">
            <div className="px-4 py-3 bg-orange-50 border-b border-orange-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                <h2 className="text-sm font-semibold text-orange-800">
                  Sin Historial — Necesitan Costo Real ({filteredNone.length} productos)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => selectAll(filteredNone)}
                className="px-3 py-1 text-xs text-orange-700 border border-orange-300 rounded-lg hover:bg-orange-100"
              >
                Seleccionar todos
              </button>
            </div>

            {/* Warning banner */}
            <div className="px-4 py-2 bg-orange-50/70 border-b border-orange-100 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-orange-700">
                Estos productos <strong>nunca tuvieron COGS registrado</strong> (muebles, productos nuevos, artículos en consignación).
                El valor que aparece es una estimación del 70% del precio de venta. <strong>Consultar con la contadora o el proveedor
                el precio de costo real</strong> antes de crear el comprobante. Puede editar el costo directamente en cada fila.
              </p>
            </div>

            {filteredNone.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="w-8 px-3 py-2">
                        <input
                          type="checkbox"
                          title="Seleccionar todos"
                          checked={filteredNone.length > 0 && filteredNone.every(p => selected.has(rowKey(p)))}
                          onChange={() => toggleAll(filteredNone)}
                          className="rounded border-gray-300"
                        />
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Mes</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Código</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Producto</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Proveedor</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Qty</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Est. 70%</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-orange-700 uppercase">Costo Real</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredNone.map(p => {
                      const key = rowKey(p);
                      const isSelected = selected.has(key);
                      const current = costOverrides[key] ?? p.estimated_cost;
                      const isZero = current === 0;
                      const isModified = current !== p.estimated_cost;
                      return (
                        <tr key={key} className={`hover:bg-gray-50 ${isSelected ? 'bg-orange-50/40' : ''}`}>
                          <td className="px-3 py-1.5 text-center">
                            <input
                              type="checkbox"
                              title={`Seleccionar ${p.product_code}`}
                              checked={isSelected}
                              onChange={() => toggle(key)}
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-xs font-medium text-gray-600">{formatMonth(p.sale_month)}</td>
                          <td className="px-3 py-1.5 font-mono text-xs text-gray-600">{p.product_code}</td>
                          <td className="px-3 py-1.5 text-gray-900 truncate max-w-[180px]" title={p.product_name}>{p.product_name}</td>
                          <td className="px-3 py-1.5 text-gray-500 text-xs">{p.supplier_name || '—'}</td>
                          <td className="px-3 py-1.5 text-right text-gray-700">{p.quantity_sold}</td>
                          <td className="px-3 py-1.5 text-right text-gray-900 font-medium">{formatCurrency(p.revenue)}</td>
                          <td className="px-3 py-1.5 text-right text-gray-400 text-xs">{formatCurrency(p.estimated_cost)}</td>
                          <td className="px-1 py-1 text-right">
                            <input
                              type="number"
                              title={`Costo real para ${p.product_code}`}
                              value={current}
                              onChange={e => setCostOverrides(prev => ({ ...prev, [key]: Math.round(Number(e.target.value) || 0) }))}
                              placeholder="Ingresar costo"
                              className={`w-36 text-right px-2 py-1 text-sm border rounded-md font-mono
                                ${isZero
                                  ? 'border-orange-400 bg-orange-50 text-orange-500 placeholder-orange-300'
                                  : isModified
                                    ? 'border-amber-400 bg-amber-50 text-amber-900 font-medium'
                                    : 'border-gray-200 text-gray-900'
                                } focus:ring-1 focus:ring-orange-500 focus:border-orange-500`}
                              min={0}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-4 py-6 text-center text-gray-400 text-sm">
                {noneRows.length === 0
                  ? 'No hay productos sin historial en este período'
                  : 'No hay resultados con los filtros actuales'}
              </p>
            )}
          </div>

          {/* ── Sección 3: Ya corregidos (journal) ── */}
          <div className="bg-white rounded-xl border border-blue-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowJournalSection(!showJournalSection)}
              className="w-full px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between hover:bg-blue-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-blue-800">
                  Ya Corregidos — Con Comprobante ({filteredJournal.length} productos)
                </h2>
                <span className="text-xs text-blue-500">— Ya tienen asiento 6135 en Siigo</span>
              </div>
              {showJournalSection
                ? <ChevronDown className="w-4 h-4 text-blue-400" />
                : <ChevronRight className="w-4 h-4 text-blue-400" />}
            </button>
            {showJournalSection && filteredJournal.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Mes</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Código</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Producto</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Proveedor</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Qty</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">COGS Reg.</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredJournal.map(p => {
                      const key = rowKey(p);
                      return (
                        <tr key={key} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-xs font-medium text-gray-600">{formatMonth(p.sale_month)}</td>
                          <td className="px-3 py-2 font-mono text-xs text-gray-600">{p.product_code}</td>
                          <td className="px-3 py-2 text-gray-900 truncate max-w-[200px]" title={p.product_name}>{p.product_name}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{p.supplier_name || '—'}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{p.quantity_sold}</td>
                          <td className="px-3 py-2 text-right text-blue-700 font-medium">{formatCurrency(p.journal_cost)}</td>
                          <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(p.revenue)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* ── Journal Modal ── */}
      {showJournalModal && selectedForJournal.length > 0 && (
        <JournalModal
          products={selectedForJournal}
          defaultDate={lastDayOfMonth(endMonth)}
          onClose={() => setShowJournalModal(false)}
          onSuccess={() => {
            setShowJournalModal(false);
            setSelected(new Set());
            loadData();
          }}
        />
      )}
    </div>
  );
}
