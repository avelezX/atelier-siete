'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Download,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface ComparisonCategory {
  siigo_debit?: number;
  siigo_credit?: number;
  ours?: number;
  ours_total?: number;
  ours_invoices?: number;
  ours_journal_41?: number;
  ours_cc?: number;
  ours_fc?: number;
  diff?: number;
  diff_vs_invoices?: number;
  diff_vs_journals?: number;
}

interface SubcatDetail {
  siigo: number;
  ours: number;
  diff: number;
}

interface MonthComparison {
  month: string;
  has_balance: boolean;
  accounts_parsed: number;
  comparison: {
    ingresos_41: ComparisonCategory;
    gastos_admin_51: ComparisonCategory;
    gastos_venta_52: ComparisonCategory;
    gastos_financieros_53: ComparisonCategory;
    costo_ventas_6135: ComparisonCategory;
  };
  subcategory_detail: Record<string, SubcatDetail>;
}

interface AnnualTotals {
  siigo: Record<string, number>;
  ours: Record<string, number>;
  diff: Record<string, number>;
}

interface CompareData {
  year: number;
  siigo_errors: string[];
  months_with_data: number;
  data_counts: Record<string, unknown>;
  months: MonthComparison[];
  annual_totals: AnnualTotals;
}

const MONTH_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

const CATEGORIES = [
  { key: 'ingresos_41', label: 'Ingresos (41)', color: 'green', isRevenue: true },
  { key: 'gastos_admin_51', label: 'Gastos Admin (51)', color: 'red' },
  { key: 'gastos_venta_52', label: 'Gastos Venta (52)', color: 'orange' },
  { key: 'gastos_financieros_53', label: 'Gastos Financieros (53)', color: 'purple' },
  { key: 'costo_ventas_6135', label: 'Costo Ventas (6135)', color: 'blue' },
];

function DiffBadge({ diff, base }: { diff: number; base: number }) {
  if (base === 0 && diff === 0) return <span className="text-xs text-gray-400">-</span>;
  const pct = base !== 0 ? ((diff / base) * 100) : 0;
  const absPct = Math.abs(pct);

  if (absPct < 1) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="w-3 h-3" />
        OK
      </span>
    );
  }
  if (absPct < 5) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
        <AlertTriangle className="w-3 h-3" />
        {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
      <XCircle className="w-3 h-3" />
      {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

function getComparisonValues(cat: ComparisonCategory, key: string) {
  if (key === 'ingresos_41') {
    return {
      siigo: cat.siigo_credit || 0,
      ours: cat.ours_journal_41 || cat.ours_invoices || 0,
      diff: cat.diff_vs_journals ?? cat.diff_vs_invoices ?? 0,
    };
  }
  if (key === 'costo_ventas_6135') {
    return {
      siigo: cat.siigo_debit || 0,
      ours: cat.ours_total || 0,
      diff: cat.diff || 0,
    };
  }
  return {
    siigo: cat.siigo_debit || 0,
    ours: cat.ours || 0,
    diff: cat.diff || 0,
  };
}

export default function CompararBalancePage() {
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [year] = useState(2025);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/comparar-balance?year=${year}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Annual summary
  const annualMatch = data ? Object.values(data.annual_totals.diff).every(d => Math.abs(d) < 100000) : false;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <BarChart3 className="w-6 h-6 text-amber-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Comparar Balance de Prueba</h1>
            <p className="text-sm text-gray-500">
              Balance de Prueba Siigo vs datos reconstruidos — {year}
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </div>

      {/* Loading state */}
      {loading && !data && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <RefreshCw className="w-8 h-8 text-amber-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Descargando Balance de Prueba de Siigo para cada mes...</p>
          <p className="text-xs text-gray-400 mt-1">Esto puede tardar ~30 segundos (12 reportes secuenciales)</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          Error: {error}
        </div>
      )}

      {data && (
        <>
          {/* Siigo errors */}
          {data.siigo_errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-medium text-amber-800">Advertencias de Siigo:</p>
              {data.siigo_errors.map((e, i) => (
                <p key={i} className="text-xs text-amber-700">{e}</p>
              ))}
            </div>
          )}

          {/* Annual Summary Card */}
          <div className={`rounded-xl border p-6 ${annualMatch ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Resumen Anual {year}
              {annualMatch && <CheckCircle2 className="w-5 h-5 text-green-600 inline ml-2" />}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {CATEGORIES.map(({ key, label, color }) => {
                const diff = data.annual_totals.diff[key] || 0;
                const siigo = data.annual_totals.siigo[key] || 0;
                const ours = data.annual_totals.ours[key] || 0;
                return (
                  <div key={key} className="bg-white rounded-lg p-3 border border-gray-200">
                    <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-400">Siigo</span>
                        <span className="text-sm font-mono font-medium">{formatCurrency(siigo)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-400">Nuestro</span>
                        <span className="text-sm font-mono">{formatCurrency(ours)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                        <span className="text-xs text-gray-400">Diferencia</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-mono ${Math.abs(diff) < 100000 ? 'text-green-600' : 'text-red-600'}`}>
                            {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                          </span>
                          <DiffBadge diff={diff} base={siigo} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monthly table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Detalle Mensual</h2>
              <p className="text-xs text-gray-500">
                Click en un mes para ver subcategorias. Meses con datos: {data.months_with_data}/12
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Mes</th>
                    {CATEGORIES.map(({ key, label }) => (
                      <th key={key} className="text-right px-3 py-2 font-medium text-gray-600" colSpan={3}>
                        <span className="text-xs">{label}</span>
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-400">
                    <th></th>
                    {CATEGORIES.map(({ key }) => (
                      <th key={key} className="text-right px-1 py-1" colSpan={3}>
                        <div className="flex justify-end gap-3">
                          <span className="w-20 text-right">Siigo</span>
                          <span className="w-20 text-right">Nuestro</span>
                          <span className="w-16 text-right">Dif</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.months.map((m, idx) => {
                    const isExpanded = expandedMonth === m.month;
                    const monthName = MONTH_NAMES[idx] || m.month;
                    const hasData = m.has_balance;

                    return (
                      <tr key={m.month} className="group">
                        <td colSpan={1 + CATEGORIES.length * 3} className="p-0">
                          {/* Main month row */}
                          <div
                            className={`flex items-center cursor-pointer hover:bg-amber-50 transition-colors ${
                              isExpanded ? 'bg-amber-50' : ''
                            } ${!hasData ? 'opacity-50' : ''}`}
                            onClick={() => setExpandedMonth(isExpanded ? null : m.month)}
                          >
                            <div className="flex items-center gap-2 px-4 py-2 w-20 shrink-0">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              )}
                              <span className="font-medium text-gray-900">{monthName}</span>
                            </div>
                            <div className="flex flex-1">
                              {CATEGORIES.map(({ key }) => {
                                const cat = m.comparison[key as keyof typeof m.comparison];
                                const { siigo, ours, diff } = getComparisonValues(cat, key);
                                return (
                                  <div key={key} className="flex-1 flex justify-end gap-3 px-3 py-2">
                                    <span className="w-20 text-right font-mono text-xs text-gray-600">
                                      {siigo > 0 ? formatCurrency(siigo) : '-'}
                                    </span>
                                    <span className="w-20 text-right font-mono text-xs text-gray-800">
                                      {ours > 0 ? formatCurrency(ours) : '-'}
                                    </span>
                                    <span className="w-16 text-right">
                                      <DiffBadge diff={diff} base={siigo} />
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Expanded subcategory detail */}
                          {isExpanded && m.subcategory_detail && (
                            <div className="bg-gray-50 border-t border-gray-100 px-6 py-3">
                              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
                                Subcategorias (cuentas 4 digitos) — {m.month}
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {Object.entries(m.subcategory_detail)
                                  .filter(([, v]) => v.siigo > 0 || v.ours > 0)
                                  .sort(([, a], [, b]) => Math.abs(b.diff) - Math.abs(a.diff))
                                  .map(([code, detail]) => (
                                    <div
                                      key={code}
                                      className={`flex items-center justify-between px-3 py-1.5 rounded text-xs ${
                                        Math.abs(detail.diff) < 1000
                                          ? 'bg-green-50'
                                          : Math.abs(detail.diff) < detail.siigo * 0.05
                                          ? 'bg-amber-50'
                                          : 'bg-red-50'
                                      }`}
                                    >
                                      <span className="font-mono font-medium text-gray-700">{code}</span>
                                      <div className="flex gap-3">
                                        <span className="text-gray-500">S: {formatCurrency(detail.siigo)}</span>
                                        <span className="text-gray-700">N: {formatCurrency(detail.ours)}</span>
                                        <span className={detail.diff === 0 ? 'text-green-600' : 'text-red-600'}>
                                          {detail.diff > 0 ? '+' : ''}{formatCurrency(detail.diff)}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                              </div>

                              {/* COGS detail */}
                              {m.comparison.costo_ventas_6135.ours_cc !== undefined && (
                                <div className="mt-3 pt-2 border-t border-gray-200">
                                  <p className="text-xs text-gray-500">
                                    COGS 6135: CC (journals) = {formatCurrency(m.comparison.costo_ventas_6135.ours_cc || 0)}
                                    {' | '}FC (compras) = {formatCurrency(m.comparison.costo_ventas_6135.ours_fc || 0)}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Data counts */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Datos en nuestra base de datos</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {Object.entries(data.data_counts).map(([key, val]) => {
                if (typeof val === 'object') return null;
                return (
                  <div key={key} className="flex justify-between bg-gray-50 rounded px-3 py-1.5">
                    <span className="text-gray-500">{key.replace(/_/g, ' ')}</span>
                    <span className="font-mono font-medium text-gray-700">
                      {typeof val === 'number' ? val.toLocaleString() : String(val)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Explanation */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-amber-900 mb-1">Nota sobre las diferencias</h3>
            <p className="text-xs text-amber-800 leading-relaxed">
              El Balance de Prueba de Siigo incluye movimientos de <strong>todos los tipos de documento</strong> (CC, FC, FV, RC, CE, NC, ND).
              Nuestra base de datos solo tiene acceso a <strong>Comprobantes Contables (CC)</strong> y <strong>Facturas de Compra (FC)</strong>
              via la API de Siigo. Los movimientos de <strong>Comprobantes de Egreso (CE)</strong> y otros tipos no estan disponibles
              en la API, lo que explica las diferencias. Las categorias mas afectadas son Gastos Financieros (5305 — cargos bancarios via CE)
              y Gastos Admin (5145 Mantenimiento, 5135 Servicios — pagos directos via CE).
            </p>
          </div>
        </>
      )}
    </div>
  );
}
