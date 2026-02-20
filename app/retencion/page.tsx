'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Landmark,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Clock,
  Calendar,
  FileText,
  DollarSign,
  TrendingDown,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

// --- Types ---

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

interface RentaData {
  formulario: string;
  tarifa: number;
  deadlines: {
    cuota1: { label: string; date: string };
    cuota2: { label: string; date: string };
  };
  pyg: {
    ingresos_brutos: number;
    devoluciones: number;
    ingresos_netos: number;
    costos: number;
    renta_bruta: number;
    gastos_admin: number;
    gastos_venta: number;
    gastos_financieros: number;
    total_deducciones: number;
    renta_liquida: number;
  };
  base_gravable: number;
  impuesto_renta: number;
  retenciones_que_le_practicaron: number;
  saldo_a_pagar: number;
  cuota1: number;
  cuota2: number;
  is_cuota1_past_due: boolean;
  is_cuota2_past_due: boolean;
}

interface DashboardData {
  year: number;
  nit: string;
  razon_social: string;
  ultimo_digito_nit: number;
  available_years: string[];
  retencion: {
    formulario: string;
    periodicidad: string;
    monthly: MonthRetencion[];
    annual_total: number;
    total_purchases_with_retention: number;
  };
  renta: RentaData;
  fuentes: Record<string, unknown>;
}

function formatDate(d: string): string {
  const [y, m, day] = d.split('-');
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
}

// --- Month Card for Retencion ---
function MonthCard({ m }: { m: MonthRetencion }) {
  const [open, setOpen] = useState(false);
  const hasData = m.total_retencion > 0;

  return (
    <div className={`bg-white rounded-lg border overflow-hidden ${
      m.is_past_due && hasData ? 'border-red-200' : 'border-gray-200'
    }`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center space-x-3">
          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <div className="text-left">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-gray-900">{m.month_label}</span>
              {m.is_past_due && hasData && (
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 rounded-full">
                  VENCIDO
                </span>
              )}
              {!hasData && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 rounded-full">
                  SIN RETENCIONES
                </span>
              )}
            </div>
            <div className="flex items-center space-x-3 text-xs text-gray-500 mt-0.5">
              <span className="flex items-center space-x-1">
                {m.is_past_due ? <AlertTriangle className="w-3 h-3 text-red-400" /> : <Clock className="w-3 h-3" />}
                <span>Vence: {formatDate(m.deadline)}</span>
              </span>
              {hasData && <span>{m.purchases_count} facturas</span>}
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">F.350</p>
          <p className={`text-lg font-bold ${hasData ? 'text-gray-900' : 'text-gray-300'}`}>
            {formatCurrency(m.total_retencion)}
          </p>
        </div>
      </button>

      {open && hasData && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          {m.by_concept.map((concept) => (
            <ConceptSection key={concept.concept} concept={concept} />
          ))}
        </div>
      )}
    </div>
  );
}

function ConceptSection({ concept }: { concept: RetentionConcept }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-2 last:mb-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-1.5 text-sm hover:bg-gray-100 px-2 rounded transition-colors"
      >
        <div className="flex items-center space-x-2">
          {open ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
          <span className="font-medium text-gray-800">{concept.concept}</span>
          <span className="text-xs text-gray-400">({concept.items_count} items, ~{concept.avg_rate.toFixed(1)}%)</span>
        </div>
        <span className="font-semibold text-gray-900">{formatCurrency(concept.total)}</span>
      </button>
      {open && (
        <div className="ml-5 mt-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 uppercase">
                <th className="text-left py-1 px-1 font-medium">Factura</th>
                <th className="text-left py-1 px-1 font-medium">Proveedor</th>
                <th className="text-left py-1 px-1 font-medium">Fecha</th>
                <th className="text-right py-1 px-1 font-medium">Base</th>
                <th className="text-right py-1 px-1 font-medium">%</th>
                <th className="text-right py-1 px-1 font-medium">Retencion</th>
              </tr>
            </thead>
            <tbody>
              {concept.details.map((d, idx) => (
                <tr key={idx} className="border-t border-gray-200">
                  <td className="py-1 px-1 text-gray-700 font-medium">{d.purchase_name}</td>
                  <td className="py-1 px-1 text-gray-600 max-w-[200px] truncate">{d.supplier_name}</td>
                  <td className="py-1 px-1 text-gray-500">{d.date}</td>
                  <td className="py-1 px-1 text-right text-gray-600">{formatCurrency(d.base)}</td>
                  <td className="py-1 px-1 text-right text-gray-500">{d.percentage}%</td>
                  <td className="py-1 px-1 text-right font-semibold text-gray-900">{formatCurrency(d.retention_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- Main Page ---
export default function RetencionRentaPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear() - 1));
  const [activeTab, setActiveTab] = useState<'retencion' | 'renta'>('retencion');

  const loadData = useCallback(async (year?: string) => {
    setLoading(true);
    setError('');
    try {
      const params = year ? `?year=${year}` : '';
      const res = await fetch(`/api/dashboard/retencion${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(selectedYear);
  }, [loadData, selectedYear]);

  const r = data?.renta;
  const ret = data?.retencion;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Landmark className="w-8 h-8 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Renta y Retencion</h1>
            <p className="text-gray-500">Formularios 110 (Renta) y 350 (Retencion en la Fuente)</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            disabled={loading}
            aria-label="Ano gravable"
          >
            {(data?.available_years || [selectedYear]).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => loadData(selectedYear)}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="text-center py-12 text-gray-500">Cargando datos...</div>
      ) : data && r && ret ? (
        <>
          {/* NIT Info */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-6">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <div>
                <span className="text-gray-500">NIT:</span>{' '}
                <span className="font-semibold text-gray-900">{data.nit}-{data.ultimo_digito_nit}</span>
              </div>
              <div>
                <span className="text-gray-500">Razon Social:</span>{' '}
                <span className="font-semibold text-gray-900">{data.razon_social}</span>
              </div>
              <div>
                <span className="text-gray-500">Ano Gravable:</span>{' '}
                <span className="font-semibold text-gray-900">{data.year}</span>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center space-x-2 mb-1">
                <FileText className="w-4 h-4 text-blue-500" />
                <p className="text-xs text-gray-500 uppercase font-semibold">Retencion en la Fuente (F.350)</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(ret.annual_total)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {ret.total_purchases_with_retention} items con retencion — Periodicidad mensual
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center space-x-2 mb-1">
                <DollarSign className="w-4 h-4 text-red-500" />
                <p className="text-xs text-gray-500 uppercase font-semibold">Impuesto de Renta (F.110)</p>
              </div>
              <p className="text-2xl font-bold text-red-700">{formatCurrency(r.impuesto_renta)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {r.tarifa}% sobre base gravable de {formatCurrency(r.base_gravable)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center space-x-2 mb-1">
                <TrendingDown className="w-4 h-4 text-amber-500" />
                <p className="text-xs text-gray-500 uppercase font-semibold">Renta — Saldo a Pagar</p>
              </div>
              <p className="text-2xl font-bold text-amber-700">{formatCurrency(r.saldo_a_pagar)}</p>
              <p className="text-xs text-gray-500 mt-1">
                2 cuotas: {formatCurrency(r.cuota1)} + {formatCurrency(r.cuota2)}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('retencion')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'retencion'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Retencion en la Fuente (F.350)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('renta')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'renta'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Renta (F.110)
            </button>
          </div>

          {/* Retencion Tab */}
          {activeTab === 'retencion' && (
            <div>
              {/* Annual summary table */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-sm font-semibold text-gray-700">
                    Resumen Mensual — Retencion en la Fuente {data.year}
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Mes</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Retencion</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Facturas</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Vencimiento</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ret.monthly.map((m) => (
                        <tr key={m.month} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium text-gray-900">{m.month_label}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${m.total_retencion > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                            {formatCurrency(m.total_retencion)}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-500">{m.purchases_count}</td>
                          <td className="px-3 py-2 text-gray-500">{formatDate(m.deadline)}</td>
                          <td className="px-3 py-2 text-center">
                            {m.total_retencion === 0 ? (
                              <span className="text-xs text-gray-400">-</span>
                            ) : m.is_past_due ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 rounded-full">
                                <AlertTriangle className="w-3 h-3" />
                                <span>VENCIDO</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded-full">
                                <Clock className="w-3 h-3" />
                                <span>PENDIENTE</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-gray-300 font-bold bg-gray-50">
                        <td className="px-4 py-2 text-gray-900">TOTAL {data.year}</td>
                        <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(ret.annual_total)}</td>
                        <td className="px-3 py-2 text-right text-gray-500">
                          {ret.monthly.reduce((s, m) => s + m.purchases_count, 0)}
                        </td>
                        <td colSpan={2} className="px-3 py-2 text-gray-500 text-xs">
                          {ret.total_purchases_with_retention} items con retencion
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Monthly detail cards */}
              <h2 className="text-sm font-semibold text-gray-700 uppercase mb-3">
                Detalle Mensual
              </h2>
              <div className="space-y-2 mb-6">
                {ret.monthly.map((m) => (
                  <MonthCard key={m.month} m={m} />
                ))}
              </div>

              {/* Methodology */}
              <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 mb-6">
                <h3 className="text-sm font-semibold text-blue-800 mb-2">Metodologia — Retencion en la Fuente</h3>
                <div className="text-xs text-blue-700 space-y-1.5">
                  <p><strong>Formulario 350:</strong> Declaracion mensual de retenciones practicadas por Atelier Siete a sus proveedores al momento de pagar facturas de compra.</p>
                  <p><strong>Fuente de datos:</strong> Campo retention_value de los items de facturas de compra en Siigo. Cada item puede tener retencion si aplica (Retefuente, Reteiva, etc.).</p>
                  <p><strong>Conceptos comunes:</strong> Retefuente por compras (2.5-3.5%), servicios (4-6%), honorarios (10-11%), arrendamientos (3.5%).</p>
                  <p><strong>Vencimientos:</strong> Calendario tributario DIAN para NIT {data.nit} (ultimo digito {data.ultimo_digito_nit}). Declaracion mensual, aproximadamente el 14 del mes siguiente.</p>
                  <p><strong>Nota:</strong> Si en un mes no hubo retenciones, no es obligatorio presentar la declaracion.</p>
                  <p className="mt-2 text-blue-600 font-medium">* Este calculo es una estimacion. La declaracion oficial debe ser preparada por un contador publico.</p>
                </div>
              </div>
            </div>
          )}

          {/* Renta Tab */}
          {activeTab === 'renta' && (
            <div>
              {/* Deadlines */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center space-x-2">
                  <Calendar className="w-4 h-4" />
                  <span>Vencimientos Renta AG {data.year} — Formulario 110</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`p-4 rounded-lg border ${
                    r.is_cuota1_past_due ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-800">{r.deadlines.cuota1.label}</span>
                      {r.is_cuota1_past_due ? (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 rounded-full flex items-center space-x-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>VENCIDO</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded-full flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>PENDIENTE</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mb-2">Vence: {formatDate(r.deadlines.cuota1.date)}</p>
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(r.cuota1)}</p>
                  </div>
                  <div className={`p-4 rounded-lg border ${
                    r.is_cuota2_past_due ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-800">{r.deadlines.cuota2.label}</span>
                      {r.is_cuota2_past_due ? (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 rounded-full flex items-center space-x-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>VENCIDO</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded-full flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>PENDIENTE</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mb-2">Vence: {formatDate(r.deadlines.cuota2.date)}</p>
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(r.cuota2)}</p>
                  </div>
                </div>
              </div>

              {/* Liquidacion de Renta */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-sm font-semibold text-gray-700">
                    Liquidacion de Renta — Ano Gravable {data.year}
                  </h2>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {/* Ingresos */}
                    <tr className="border-b border-gray-100">
                      <td className="px-5 py-3 text-gray-800 font-medium">Ingresos Brutos</td>
                      <td className="px-5 py-3 text-right text-gray-600 text-xs">Facturas de venta (subtotal sin IVA)</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900 w-48">
                        {formatCurrency(r.pyg.ingresos_brutos)}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="px-5 py-3 text-gray-600">(-) Devoluciones y Descuentos</td>
                      <td className="px-5 py-3 text-right text-gray-600 text-xs">Notas credito</td>
                      <td className="px-5 py-3 text-right text-red-600 w-48">
                        -{formatCurrency(r.pyg.devoluciones)}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <td className="px-5 py-3 text-gray-900 font-semibold" colSpan={2}>= Ingresos Netos</td>
                      <td className="px-5 py-3 text-right font-bold text-gray-900 w-48">
                        {formatCurrency(r.pyg.ingresos_netos)}
                      </td>
                    </tr>

                    {/* Costos */}
                    <tr className="border-b border-gray-100">
                      <td className="px-5 py-3 text-gray-600">(-) Costo de Ventas</td>
                      <td className="px-5 py-3 text-right text-gray-600 text-xs">Cuenta 6135xx</td>
                      <td className="px-5 py-3 text-right text-red-600 w-48">
                        -{formatCurrency(r.pyg.costos)}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <td className="px-5 py-3 text-gray-900 font-semibold" colSpan={2}>= Renta Bruta</td>
                      <td className="px-5 py-3 text-right font-bold text-gray-900 w-48">
                        {formatCurrency(r.pyg.renta_bruta)}
                      </td>
                    </tr>

                    {/* Deducciones */}
                    <tr className="border-b border-gray-100">
                      <td className="px-5 py-3 text-gray-600">(-) Gastos de Administracion</td>
                      <td className="px-5 py-3 text-right text-gray-600 text-xs">Cuentas 51xx</td>
                      <td className="px-5 py-3 text-right text-red-600 w-48">
                        -{formatCurrency(r.pyg.gastos_admin)}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="px-5 py-3 text-gray-600">(-) Gastos de Ventas</td>
                      <td className="px-5 py-3 text-right text-gray-600 text-xs">Cuentas 52xx</td>
                      <td className="px-5 py-3 text-right text-red-600 w-48">
                        -{formatCurrency(r.pyg.gastos_venta)}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="px-5 py-3 text-gray-600">(-) Gastos Financieros / No Operacionales</td>
                      <td className="px-5 py-3 text-right text-gray-600 text-xs">Cuentas 53xx</td>
                      <td className="px-5 py-3 text-right text-red-600 w-48">
                        -{formatCurrency(r.pyg.gastos_financieros)}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <td className="px-5 py-3 text-gray-900 font-semibold">= Renta Liquida</td>
                      <td className="px-5 py-3 text-right text-gray-500 text-xs">Total deducciones: {formatCurrency(r.pyg.total_deducciones)}</td>
                      <td className={`px-5 py-3 text-right font-bold w-48 ${r.pyg.renta_liquida >= 0 ? 'text-gray-900' : 'text-green-700'}`}>
                        {formatCurrency(r.pyg.renta_liquida)}
                      </td>
                    </tr>

                    {/* Separator */}
                    <tr>
                      <td colSpan={3} className="py-1">
                        <div className="border-t-2 border-gray-300" />
                      </td>
                    </tr>

                    {/* Tax calculation */}
                    <tr className="border-b border-gray-100">
                      <td className="px-5 py-3 text-gray-800 font-medium">Base Gravable</td>
                      <td className="px-5 py-3 text-right text-gray-600 text-xs">Max(Renta Liquida, 0)</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900 w-48">
                        {formatCurrency(r.base_gravable)}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-100 bg-red-50">
                      <td className="px-5 py-3 text-red-800 font-bold">Impuesto de Renta</td>
                      <td className="px-5 py-3 text-right text-red-600 text-xs">x {r.tarifa}%</td>
                      <td className="px-5 py-3 text-right font-bold text-red-800 text-lg w-48">
                        {formatCurrency(r.impuesto_renta)}
                      </td>
                    </tr>

                    {r.retenciones_que_le_practicaron > 0 && (
                      <tr className="border-b border-gray-100">
                        <td className="px-5 py-3 text-gray-600">(-) Retenciones que le practicaron</td>
                        <td className="px-5 py-3 text-right text-gray-600 text-xs">Reduce saldo a pagar</td>
                        <td className="px-5 py-3 text-right text-green-600 w-48">
                          -{formatCurrency(r.retenciones_que_le_practicaron)}
                        </td>
                      </tr>
                    )}

                    <tr className="bg-amber-50">
                      <td className="px-5 py-3 text-amber-900 font-bold" colSpan={2}>= Saldo a Pagar DIAN</td>
                      <td className="px-5 py-3 text-right font-bold text-amber-900 text-lg w-48">
                        {formatCurrency(r.saldo_a_pagar)}
                      </td>
                    </tr>

                    {/* Payment split */}
                    <tr className="border-t border-amber-200 text-xs">
                      <td className="px-5 py-2 text-gray-500 italic" colSpan={2}>
                        1a cuota ({formatDate(r.deadlines.cuota1.date)})
                        {r.is_cuota1_past_due && <span className="text-red-600 font-medium ml-1">— VENCIDO</span>}
                      </td>
                      <td className="px-5 py-2 text-right text-gray-700 font-semibold w-48">
                        {formatCurrency(r.cuota1)}
                      </td>
                    </tr>
                    <tr className="text-xs">
                      <td className="px-5 py-2 text-gray-500 italic" colSpan={2}>
                        2a cuota ({formatDate(r.deadlines.cuota2.date)})
                        {r.is_cuota2_past_due && <span className="text-red-600 font-medium ml-1">— VENCIDO</span>}
                      </td>
                      <td className="px-5 py-2 text-right text-gray-700 font-semibold w-48">
                        {formatCurrency(r.cuota2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Methodology */}
              <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 mb-6">
                <h3 className="text-sm font-semibold text-blue-800 mb-2">Metodologia — Impuesto de Renta</h3>
                <div className="text-xs text-blue-700 space-y-1.5">
                  <p><strong>Formulario 110:</strong> Declaracion anual de renta para personas juridicas. Se paga en dos cuotas iguales.</p>
                  <p><strong>Tarifa:</strong> {r.tarifa}% para personas juridicas (Art. 240 Estatuto Tributario, modificado por Ley 2277 de 2022).</p>
                  <p><strong>Ingresos:</strong> Subtotal (sin IVA) de facturas de venta no anuladas.</p>
                  <p><strong>Costos:</strong> Costo de ventas de cuentas PUC 6135xx (debito en comprobantes contables).</p>
                  <p><strong>Deducciones:</strong> Gastos operacionales y no operacionales de cuentas 51xx, 52xx, 53xx (combinando comprobantes contables y facturas de compra).</p>
                  <p><strong>Retenciones que le practicaron:</strong> Si clientes de Atelier retuvieron impuesto al pagar facturas, eso reduce el saldo a pagar. Actualmente no incluido en este calculo — consultar con el contador.</p>
                  <p><strong>Otros conceptos no incluidos:</strong> Rentas exentas, compensacion de perdidas fiscales, descuentos tributarios, anticipo de renta, autorretenciones. Estos requieren revision por un contador.</p>
                  <p><strong>Vencimientos:</strong> Calendario tributario DIAN para NIT {data.nit} (ultimo digito {data.ultimo_digito_nit}).</p>
                  <p className="mt-2 text-blue-600 font-medium">* Este calculo es una estimacion basada en los datos contables disponibles en Siigo. La declaracion oficial debe ser preparada por un contador publico.</p>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
