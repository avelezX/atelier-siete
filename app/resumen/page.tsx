'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Info,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface MonthData {
  month: string;
  ventas_brutas: number;
  notas_credito: number;
  ventas_netas: number;
  costo_ventas: number;
  utilidad_bruta: number;
  margen_bruto_pct: number;
  gastos_admin: number;
  gastos_venta: number;
  gastos_financieros: number;
  total_gastos: number;
  utilidad_operativa: number;
  iva_generado: number;
  iva_nc: number;
  iva_descontable: number;
  iva_neto: number;
  renta_estimada: number;
  invoices_count: number;
  cn_count: number;
}

interface ExpenseItem {
  source: 'CC' | 'FC';
  document_name: string;
  date: string;
  account_code: string;
  description: string;
  supplier_name: string | null;
  value: number;
}

interface ExpenseSubcategory {
  account_prefix: string;
  category: string;
  total: number;
  entries: number;
  items: ExpenseItem[];
}

interface ExpenseGroup {
  group: string;
  group_label: string;
  total: number;
  entries: number;
  subcategories: ExpenseSubcategory[];
}

interface RevenueItem {
  invoice_name: string;
  date: string;
  customer_name: string;
  product_code: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface SupplierRevenue {
  supplier_name: string;
  total: number;
  items_count: number;
  products_count: number;
  items: RevenueItem[];
}

interface RowBreakdown {
  label: string;
  by_month: Record<string, number>;
  total: number;
}

interface RowDetails {
  ventas_brutas: RowBreakdown[];
  costo_ventas: RowBreakdown[];
  gastos_admin: RowBreakdown[];
  gastos_venta: RowBreakdown[];
  gastos_financieros: RowBreakdown[];
}

interface ResumenData {
  months: MonthData[];
  totals: MonthData;
  gastos_groups: ExpenseGroup[];
  ventas_by_supplier: SupplierRevenue[];
  row_details: RowDetails;
  data_counts: {
    invoices: number;
    credit_notes: number;
    journals: number;
    purchases: number;
    cogs_items: number;
    expense_items_journal: number;
    expense_items_purchase: number;
    iva_items: number;
    invoice_items: number;
    products: number;
    suppliers_with_sales: number;
  };
}

// --- Expandable expense components ---

function ExpenseGroupRow({ group, totalGastos, yearFilter }: { group: ExpenseGroup; totalGastos: number; yearFilter: string }) {
  const [open, setOpen] = useState(false);

  // Filter items by year if needed
  const filteredSubs = yearFilter === 'all'
    ? group.subcategories
    : group.subcategories.map(sub => {
        const items = sub.items.filter(i => i.date.startsWith(yearFilter));
        return { ...sub, items, total: items.reduce((s, i) => s + i.value, 0), entries: items.length };
      }).filter(sub => sub.entries > 0);

  const filteredTotal = filteredSubs.reduce((s, sc) => s + sc.total, 0);
  const filteredEntries = filteredSubs.reduce((s, sc) => s + sc.entries, 0);

  if (filteredEntries === 0) return null;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-sm"
      >
        <div className="flex items-center space-x-2">
          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <span className="font-semibold text-gray-800">{group.group_label}</span>
          <span className="text-xs text-gray-400">({filteredEntries})</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-xs text-gray-400">{pct(filteredTotal, totalGastos)}</span>
          <span className="font-semibold text-gray-900 w-36 text-right">{formatCurrency(filteredTotal)}</span>
        </div>
      </button>
      {open && (
        <div className="pl-6 border-l-2 border-gray-100 ml-4">
          {filteredSubs.map((sub) => (
            <ExpenseSubcategoryRow key={sub.account_prefix} sub={sub} groupTotal={filteredTotal} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExpenseSubcategoryRow({ sub, groupTotal }: { sub: ExpenseSubcategory; groupTotal: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors text-sm"
      >
        <div className="flex items-center space-x-2">
          {open ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
          <span className="font-medium text-gray-700">{sub.category}</span>
          <span className="text-xs text-gray-400 font-mono">{sub.account_prefix}</span>
          <span className="text-xs text-gray-400">({sub.entries})</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-xs text-gray-400">{pct(sub.total, groupTotal)}</span>
          <span className="font-medium text-gray-800 w-36 text-right">{formatCurrency(sub.total)}</span>
        </div>
      </button>
      {open && (
        <div className="pl-5 mb-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 uppercase">
                <th className="text-left py-1 px-2 font-medium">Fuente</th>
                <th className="text-left py-1 px-2 font-medium">Documento</th>
                <th className="text-left py-1 px-2 font-medium">Fecha</th>
                <th className="text-left py-1 px-2 font-medium">Proveedor / Descripcion</th>
                <th className="text-right py-1 px-2 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {sub.items.map((item, idx) => (
                <tr key={idx} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="py-1 px-2">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      item.source === 'FC' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {item.source}
                    </span>
                  </td>
                  <td className="py-1 px-2 font-mono text-gray-600">{item.document_name}</td>
                  <td className="py-1 px-2 text-gray-500">{item.date}</td>
                  <td className="py-1 px-2 text-gray-600 truncate max-w-xs">
                    {item.supplier_name || item.description}
                  </td>
                  <td className="py-1 px-2 text-right font-medium text-gray-800">{formatCurrency(item.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SupplierRevenueRow({ supplier, totalRevenue, yearFilter }: { supplier: SupplierRevenue; totalRevenue: number; yearFilter: string }) {
  const [open, setOpen] = useState(false);

  const filteredItems = yearFilter === 'all'
    ? supplier.items
    : supplier.items.filter(i => i.date.startsWith(yearFilter));

  const filteredTotal = filteredItems.reduce((s, i) => s + i.line_total, 0);
  const filteredProducts = new Set(filteredItems.map(i => i.product_code)).size;

  if (filteredItems.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-sm"
      >
        <div className="flex items-center space-x-2">
          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <span className="font-semibold text-gray-800">{supplier.supplier_name}</span>
          <span className="text-xs text-gray-400">({filteredItems.length} items, {filteredProducts} productos)</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-xs text-gray-400">{pct(filteredTotal, totalRevenue)}</span>
          <span className="font-semibold text-gray-900 w-36 text-right">{formatCurrency(filteredTotal)}</span>
        </div>
      </button>
      {open && (
        <div className="pl-5 mb-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 uppercase">
                <th className="text-left py-1 px-2 font-medium">Factura</th>
                <th className="text-left py-1 px-2 font-medium">Fecha</th>
                <th className="text-left py-1 px-2 font-medium">Cliente</th>
                <th className="text-left py-1 px-2 font-medium">Producto</th>
                <th className="text-right py-1 px-2 font-medium">Cant</th>
                <th className="text-right py-1 px-2 font-medium">Precio</th>
                <th className="text-right py-1 px-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.slice(0, 50).map((item, idx) => (
                <tr key={idx} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="py-1 px-2 font-mono text-gray-600">{item.invoice_name}</td>
                  <td className="py-1 px-2 text-gray-500">{item.date}</td>
                  <td className="py-1 px-2 text-gray-600 truncate max-w-[150px]">{item.customer_name}</td>
                  <td className="py-1 px-2 text-gray-600 truncate max-w-[200px]">{item.product_name}</td>
                  <td className="py-1 px-2 text-right text-gray-500">{item.quantity}</td>
                  <td className="py-1 px-2 text-right text-gray-500">{formatCurrency(item.unit_price)}</td>
                  <td className="py-1 px-2 text-right font-medium text-gray-800">{formatCurrency(item.line_total)}</td>
                </tr>
              ))}
              {filteredItems.length > 50 && (
                <tr>
                  <td colSpan={7} className="py-2 px-2 text-center text-gray-400 italic">
                    ... y {filteredItems.length - 50} items mas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function monthLabel(yyyymm: string): string {
  if (yyyymm === 'TOTAL') return 'TOTAL';
  const [y, m] = yyyymm.split('-');
  const short = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
  ];
  return `${short[parseInt(m) - 1]} ${y}`;
}

function monthLabelFull(yyyymm: string): string {
  const [y, m] = yyyymm.split('-');
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function pct(value: number, total: number): string {
  if (total === 0) return '0.0%';
  return ((value / total) * 100).toFixed(1) + '%';
}

type YearFilter = 'all' | string;

export default function ResumenPage() {
  const [data, setData] = useState<ResumenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showGastos, setShowGastos] = useState(false);
  const [showVentas, setShowVentas] = useState(false);
  const [showIva, setShowIva] = useState(false);
  const [yearFilter, setYearFilter] = useState<YearFilter>(String(new Date().getFullYear()));
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const router = useRouter();

  function toggleRow(key: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/dashboard/resumen');
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
    loadData();
  }, [loadData]);

  // Filter months by year
  const availableYears = data
    ? [...new Set(data.months.map((m) => m.month.substring(0, 4)))].sort()
    : [];

  const filteredMonths = data
    ? yearFilter === 'all'
      ? data.months
      : data.months.filter((m) => m.month.startsWith(yearFilter))
    : [];

  // Recalculate totals for filtered months
  const filteredTotals: MonthData | null = filteredMonths.length > 0
    ? filteredMonths.reduce(
        (acc, m) => ({
          ...acc,
          ventas_brutas: acc.ventas_brutas + m.ventas_brutas,
          notas_credito: acc.notas_credito + m.notas_credito,
          ventas_netas: acc.ventas_netas + m.ventas_netas,
          costo_ventas: acc.costo_ventas + m.costo_ventas,
          utilidad_bruta: acc.utilidad_bruta + m.utilidad_bruta,
          gastos_admin: acc.gastos_admin + m.gastos_admin,
          gastos_venta: acc.gastos_venta + m.gastos_venta,
          gastos_financieros: acc.gastos_financieros + m.gastos_financieros,
          total_gastos: acc.total_gastos + m.total_gastos,
          utilidad_operativa: acc.utilidad_operativa + m.utilidad_operativa,
          iva_generado: acc.iva_generado + m.iva_generado,
          iva_nc: acc.iva_nc + m.iva_nc,
          iva_descontable: acc.iva_descontable + m.iva_descontable,
          iva_neto: acc.iva_neto + m.iva_neto,
          renta_estimada: acc.renta_estimada + m.renta_estimada,
          invoices_count: acc.invoices_count + m.invoices_count,
          cn_count: acc.cn_count + m.cn_count,
        }),
        {
          month: 'TOTAL', ventas_brutas: 0, notas_credito: 0, ventas_netas: 0,
          costo_ventas: 0, utilidad_bruta: 0, margen_bruto_pct: 0,
          gastos_admin: 0, gastos_venta: 0, gastos_financieros: 0,
          total_gastos: 0, utilidad_operativa: 0, iva_generado: 0,
          iva_nc: 0, iva_descontable: 0, iva_neto: 0,
          renta_estimada: 0, invoices_count: 0, cn_count: 0,
        }
      )
    : null;

  if (filteredTotals) {
    filteredTotals.margen_bruto_pct = filteredTotals.ventas_netas > 0
      ? (filteredTotals.utilidad_bruta / filteredTotals.ventas_netas) * 100
      : 0;
  }

  const t = filteredTotals;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <BarChart3 className="w-8 h-8 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Resumen Financiero</h1>
            <p className="text-gray-500">
              Estado de Resultados, IVA y Renta
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {/* Year filter */}
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            disabled={loading}
          >
            <option value="all">Todos los anos</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={loadData}
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
        <div className="text-center py-12 text-gray-500">
          Cargando resumen financiero...
        </div>
      ) : data && t ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center space-x-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <p className="text-xs text-gray-500">Ventas Netas</p>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(t.ventas_netas)}
              </p>
              <p className="text-xs text-gray-400">
                {t.invoices_count} facturas
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center space-x-2 mb-1">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <p className="text-xs text-gray-500">Costo de Ventas</p>
              </div>
              <p className="text-lg font-bold text-red-700">
                {formatCurrency(t.costo_ventas)}
              </p>
              <p className="text-xs text-gray-400">
                {pct(t.costo_ventas, t.ventas_netas)} de ventas
              </p>
            </div>
            <div className={`bg-white rounded-xl border p-4 ${t.utilidad_bruta >= 0 ? 'border-green-200' : 'border-red-200'}`}>
              <div className="flex items-center space-x-2 mb-1">
                <DollarSign className={`w-4 h-4 ${t.utilidad_bruta >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                <p className="text-xs text-gray-500">Utilidad Bruta</p>
              </div>
              <p className={`text-lg font-bold ${t.utilidad_bruta >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatCurrency(t.utilidad_bruta)}
              </p>
              <p className="text-xs text-gray-400">
                Margen: {t.margen_bruto_pct.toFixed(1)}%
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center space-x-2 mb-1">
                <TrendingDown className="w-4 h-4 text-orange-500" />
                <p className="text-xs text-gray-500">Gastos Operativos</p>
              </div>
              <p className="text-lg font-bold text-orange-700">
                {formatCurrency(t.total_gastos)}
              </p>
              <p className="text-xs text-gray-400">
                {pct(t.total_gastos, t.ventas_netas)} de ventas
              </p>
            </div>
            <div className={`bg-white rounded-xl border p-4 ${t.utilidad_operativa >= 0 ? 'border-green-200' : 'border-red-200'}`}>
              <div className="flex items-center space-x-2 mb-1">
                <DollarSign className={`w-4 h-4 ${t.utilidad_operativa >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                <p className="text-xs text-gray-500">Utilidad Operativa</p>
              </div>
              <p className={`text-lg font-bold ${t.utilidad_operativa >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatCurrency(t.utilidad_operativa)}
              </p>
              <p className="text-xs text-gray-400">
                {pct(t.utilidad_operativa, t.ventas_netas)} de ventas
              </p>
            </div>
          </div>

          {/* IVA and Renta cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
              <p className="text-xs text-amber-600 mb-1">IVA Generado (Ventas)</p>
              <p className="text-lg font-bold text-amber-900">
                {formatCurrency(t.iva_generado)}
              </p>
            </div>
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
              <p className="text-xs text-blue-600 mb-1">IVA Descontable (Compras)</p>
              <p className="text-lg font-bold text-blue-900">
                {formatCurrency(t.iva_descontable)}
              </p>
              <p className="text-xs text-blue-500">
                NC: -{formatCurrency(t.iva_nc)}
              </p>
            </div>
            <div className={`rounded-xl border p-4 ${t.iva_neto >= 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <p className={`text-xs mb-1 ${t.iva_neto >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                IVA Neto a Pagar
              </p>
              <p className={`text-lg font-bold ${t.iva_neto >= 0 ? 'text-red-900' : 'text-green-900'}`}>
                {formatCurrency(t.iva_neto)}
              </p>
              <p className={`text-xs ${t.iva_neto >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                Generado - Descontable - NC
              </p>
            </div>
          </div>

          {/* Renta card */}
          <div className="bg-purple-50 rounded-xl border border-purple-200 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-600 mb-1">Renta Estimada (35% sobre utilidad operativa)</p>
                <p className="text-2xl font-bold text-purple-900">
                  {formatCurrency(t.renta_estimada)}
                </p>
              </div>
              <div className="text-right text-sm text-purple-700">
                <p>Base gravable: {formatCurrency(Math.max(t.utilidad_operativa, 0))}</p>
                <p>Tasa: 35%</p>
              </div>
            </div>
            <p className="text-xs text-purple-400 mt-2">
              * Estimacion simplificada. No incluye deducciones especiales, rentas exentas ni renta presuntiva.
            </p>
          </div>

          {/* Monthly P&L Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">
                Estado de Resultados Mensual
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase sticky left-0 bg-gray-50 min-w-[180px]">
                      Concepto
                    </th>
                    {filteredMonths.map((m) => (
                      <th key={m.month} className="text-right px-3 py-3 text-xs font-semibold uppercase whitespace-nowrap min-w-[120px]">
                        <button
                          type="button"
                          onClick={() => router.push(`/resumen/mes?month=${m.month}`)}
                          className="text-amber-700 hover:text-amber-900 hover:underline cursor-pointer"
                        >
                          {monthLabel(m.month)}
                        </button>
                      </th>
                    ))}
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-900 uppercase bg-gray-100 min-w-[120px]">
                      TOTAL
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Ventas Brutas */}
                  <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => toggleRow('ventas_brutas')}>
                    <td className="px-4 py-2 font-medium text-gray-900 sticky left-0 bg-white">
                      <span className="inline-flex items-center gap-1">
                        {expandedRows.has('ventas_brutas') ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
                        Ventas Brutas
                      </span>
                    </td>
                    {filteredMonths.map((m) => (
                      <td key={m.month} className="px-3 py-2 text-right text-gray-900">
                        {formatCurrency(m.ventas_brutas)}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold text-gray-900 bg-gray-50">
                      {formatCurrency(t.ventas_brutas)}
                    </td>
                  </tr>
                  {expandedRows.has('ventas_brutas') && data.row_details.ventas_brutas.map((bd) => (
                    <tr key={bd.label} className="border-b border-gray-50 bg-green-50/30">
                      <td className="pl-9 pr-4 py-1.5 text-xs text-gray-500 sticky left-0 bg-green-50/30 truncate max-w-[180px]" title={bd.label}>
                        {bd.label}
                      </td>
                      {filteredMonths.map((m) => (
                        <td key={m.month} className="px-3 py-1.5 text-right text-xs text-gray-500">
                          {formatCurrency(bd.by_month[m.month] || 0)}
                        </td>
                      ))}
                      <td className="px-4 py-1.5 text-right text-xs font-medium text-gray-600 bg-gray-50/50">
                        {formatCurrency(filteredMonths.reduce((s, m) => s + (bd.by_month[m.month] || 0), 0))}
                      </td>
                    </tr>
                  ))}

                  {/* Notas Credito */}
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-600 sticky left-0 bg-white">
                      (-) Notas Credito
                    </td>
                    {filteredMonths.map((m) => (
                      <td key={m.month} className="px-3 py-2 text-right text-red-600">
                        {m.notas_credito > 0 ? `-${formatCurrency(m.notas_credito)}` : formatCurrency(0)}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold text-red-600 bg-gray-50">
                      -{formatCurrency(t.notas_credito)}
                    </td>
                  </tr>

                  {/* Ventas Netas */}
                  <tr className="border-b border-gray-200 bg-green-50 font-semibold">
                    <td className="px-4 py-2 text-green-800 sticky left-0 bg-green-50">
                      = Ventas Netas
                    </td>
                    {filteredMonths.map((m) => (
                      <td key={m.month} className="px-3 py-2 text-right text-green-800">
                        {formatCurrency(m.ventas_netas)}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right text-green-900 bg-green-100">
                      {formatCurrency(t.ventas_netas)}
                    </td>
                  </tr>

                  {/* Costo de Ventas */}
                  <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => toggleRow('costo_ventas')}>
                    <td className="px-4 py-2 text-gray-600 sticky left-0 bg-white">
                      <span className="inline-flex items-center gap-1">
                        {expandedRows.has('costo_ventas') ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
                        (-) Costo de Ventas
                      </span>
                    </td>
                    {filteredMonths.map((m) => (
                      <td key={m.month} className="px-3 py-2 text-right text-red-600">
                        {formatCurrency(m.costo_ventas)}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold text-red-600 bg-gray-50">
                      {formatCurrency(t.costo_ventas)}
                    </td>
                  </tr>
                  {expandedRows.has('costo_ventas') && data.row_details.costo_ventas.map((bd) => (
                    <tr key={bd.label} className="border-b border-gray-50 bg-red-50/20">
                      <td className="pl-9 pr-4 py-1.5 text-xs text-gray-500 sticky left-0 bg-red-50/20 truncate max-w-[180px]" title={bd.label}>
                        {bd.label}
                      </td>
                      {filteredMonths.map((m) => (
                        <td key={m.month} className="px-3 py-1.5 text-right text-xs text-red-400">
                          {formatCurrency(bd.by_month[m.month] || 0)}
                        </td>
                      ))}
                      <td className="px-4 py-1.5 text-right text-xs font-medium text-red-500 bg-gray-50/50">
                        {formatCurrency(filteredMonths.reduce((s, m) => s + (bd.by_month[m.month] || 0), 0))}
                      </td>
                    </tr>
                  ))}

                  {/* Utilidad Bruta */}
                  <tr className="border-b border-gray-200 bg-blue-50 font-semibold">
                    <td className="px-4 py-2 text-blue-800 sticky left-0 bg-blue-50">
                      = Utilidad Bruta
                    </td>
                    {filteredMonths.map((m) => (
                      <td key={m.month} className={`px-3 py-2 text-right ${m.utilidad_bruta >= 0 ? 'text-blue-800' : 'text-red-700'}`}>
                        {formatCurrency(m.utilidad_bruta)}
                      </td>
                    ))}
                    <td className={`px-4 py-2 text-right bg-blue-100 ${t.utilidad_bruta >= 0 ? 'text-blue-900' : 'text-red-700'}`}>
                      {formatCurrency(t.utilidad_bruta)}
                    </td>
                  </tr>

                  {/* Margen Bruto */}
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-500 italic sticky left-0 bg-white text-xs">
                      Margen Bruto %
                    </td>
                    {filteredMonths.map((m) => (
                      <td key={m.month} className="px-3 py-2 text-right text-gray-500 text-xs">
                        {m.margen_bruto_pct.toFixed(1)}%
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold text-gray-600 bg-gray-50 text-xs">
                      {t.margen_bruto_pct.toFixed(1)}%
                    </td>
                  </tr>

                  {/* Gastos Administracion */}
                  <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => toggleRow('gastos_admin')}>
                    <td className="px-4 py-2 text-gray-600 sticky left-0 bg-white">
                      <span className="inline-flex items-center gap-1">
                        {expandedRows.has('gastos_admin') ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
                        (-) Gastos Admin
                      </span>
                    </td>
                    {filteredMonths.map((m) => (
                      <td key={m.month} className="px-3 py-2 text-right text-orange-600">
                        {formatCurrency(m.gastos_admin)}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold text-orange-600 bg-gray-50">
                      {formatCurrency(t.gastos_admin)}
                    </td>
                  </tr>
                  {expandedRows.has('gastos_admin') && data.row_details.gastos_admin.map((bd) => (
                    <tr key={bd.label} className="border-b border-gray-50 bg-orange-50/20">
                      <td className="pl-9 pr-4 py-1.5 text-xs text-gray-500 sticky left-0 bg-orange-50/20 truncate max-w-[180px]" title={bd.label}>
                        {bd.label}
                      </td>
                      {filteredMonths.map((m) => (
                        <td key={m.month} className="px-3 py-1.5 text-right text-xs text-orange-400">
                          {formatCurrency(bd.by_month[m.month] || 0)}
                        </td>
                      ))}
                      <td className="px-4 py-1.5 text-right text-xs font-medium text-orange-500 bg-gray-50/50">
                        {formatCurrency(filteredMonths.reduce((s, m) => s + (bd.by_month[m.month] || 0), 0))}
                      </td>
                    </tr>
                  ))}

                  {/* Gastos Ventas */}
                  <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => toggleRow('gastos_venta')}>
                    <td className="px-4 py-2 text-gray-600 sticky left-0 bg-white">
                      <span className="inline-flex items-center gap-1">
                        {expandedRows.has('gastos_venta') ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
                        (-) Gastos Venta
                      </span>
                    </td>
                    {filteredMonths.map((m) => (
                      <td key={m.month} className="px-3 py-2 text-right text-orange-600">
                        {formatCurrency(m.gastos_venta)}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold text-orange-600 bg-gray-50">
                      {formatCurrency(t.gastos_venta)}
                    </td>
                  </tr>
                  {expandedRows.has('gastos_venta') && data.row_details.gastos_venta.map((bd) => (
                    <tr key={bd.label} className="border-b border-gray-50 bg-orange-50/20">
                      <td className="pl-9 pr-4 py-1.5 text-xs text-gray-500 sticky left-0 bg-orange-50/20 truncate max-w-[180px]" title={bd.label}>
                        {bd.label}
                      </td>
                      {filteredMonths.map((m) => (
                        <td key={m.month} className="px-3 py-1.5 text-right text-xs text-orange-400">
                          {formatCurrency(bd.by_month[m.month] || 0)}
                        </td>
                      ))}
                      <td className="px-4 py-1.5 text-right text-xs font-medium text-orange-500 bg-gray-50/50">
                        {formatCurrency(filteredMonths.reduce((s, m) => s + (bd.by_month[m.month] || 0), 0))}
                      </td>
                    </tr>
                  ))}

                  {/* Gastos Financieros */}
                  <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => toggleRow('gastos_financieros')}>
                    <td className="px-4 py-2 text-gray-600 sticky left-0 bg-white">
                      <span className="inline-flex items-center gap-1">
                        {expandedRows.has('gastos_financieros') ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
                        (-) Gastos Financieros
                      </span>
                    </td>
                    {filteredMonths.map((m) => (
                      <td key={m.month} className="px-3 py-2 text-right text-orange-600">
                        {formatCurrency(m.gastos_financieros)}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold text-orange-600 bg-gray-50">
                      {formatCurrency(t.gastos_financieros)}
                    </td>
                  </tr>
                  {expandedRows.has('gastos_financieros') && data.row_details.gastos_financieros.map((bd) => (
                    <tr key={bd.label} className="border-b border-gray-50 bg-orange-50/20">
                      <td className="pl-9 pr-4 py-1.5 text-xs text-gray-500 sticky left-0 bg-orange-50/20 truncate max-w-[180px]" title={bd.label}>
                        {bd.label}
                      </td>
                      {filteredMonths.map((m) => (
                        <td key={m.month} className="px-3 py-1.5 text-right text-xs text-orange-400">
                          {formatCurrency(bd.by_month[m.month] || 0)}
                        </td>
                      ))}
                      <td className="px-4 py-1.5 text-right text-xs font-medium text-orange-500 bg-gray-50/50">
                        {formatCurrency(filteredMonths.reduce((s, m) => s + (bd.by_month[m.month] || 0), 0))}
                      </td>
                    </tr>
                  ))}

                  {/* Utilidad Operativa */}
                  <tr className="border-b border-gray-200 bg-amber-50 font-bold">
                    <td className="px-4 py-3 text-amber-900 sticky left-0 bg-amber-50">
                      = Utilidad Operativa
                    </td>
                    {filteredMonths.map((m) => (
                      <td key={m.month} className={`px-3 py-3 text-right ${m.utilidad_operativa >= 0 ? 'text-amber-900' : 'text-red-700'}`}>
                        {formatCurrency(m.utilidad_operativa)}
                      </td>
                    ))}
                    <td className={`px-4 py-3 text-right bg-amber-100 ${t.utilidad_operativa >= 0 ? 'text-amber-900' : 'text-red-700'}`}>
                      {formatCurrency(t.utilidad_operativa)}
                    </td>
                  </tr>

                  {/* Separator */}
                  <tr className="border-b border-gray-300">
                    <td colSpan={filteredMonths.length + 2} className="py-1" />
                  </tr>

                  {/* IVA Generado */}
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-600 sticky left-0 bg-white">
                      IVA Generado (Ventas)
                    </td>
                    {filteredMonths.map((m) => (
                      <td key={m.month} className="px-3 py-2 text-right text-amber-700">
                        {formatCurrency(m.iva_generado)}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold text-amber-700 bg-gray-50">
                      {formatCurrency(t.iva_generado)}
                    </td>
                  </tr>

                  {/* IVA Descontable */}
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-600 sticky left-0 bg-white">
                      (-) IVA Descontable (Compras)
                    </td>
                    {filteredMonths.map((m) => (
                      <td key={m.month} className="px-3 py-2 text-right text-blue-600">
                        {formatCurrency(m.iva_descontable)}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold text-blue-600 bg-gray-50">
                      {formatCurrency(t.iva_descontable)}
                    </td>
                  </tr>

                  {/* IVA NC */}
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-600 sticky left-0 bg-white">
                      (-) IVA Notas Credito
                    </td>
                    {filteredMonths.map((m) => (
                      <td key={m.month} className="px-3 py-2 text-right text-red-500">
                        {m.iva_nc > 0 ? `-${formatCurrency(m.iva_nc)}` : formatCurrency(0)}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold text-red-500 bg-gray-50">
                      -{formatCurrency(t.iva_nc)}
                    </td>
                  </tr>

                  {/* IVA Neto */}
                  <tr className="border-b border-gray-200 bg-red-50 font-semibold">
                    <td className="px-4 py-2 text-red-800 sticky left-0 bg-red-50">
                      = IVA Neto a Pagar
                    </td>
                    {filteredMonths.map((m) => (
                      <td key={m.month} className={`px-3 py-2 text-right ${m.iva_neto >= 0 ? 'text-red-800' : 'text-green-700'}`}>
                        {formatCurrency(m.iva_neto)}
                      </td>
                    ))}
                    <td className={`px-4 py-2 text-right bg-red-100 ${t.iva_neto >= 0 ? 'text-red-900' : 'text-green-700'}`}>
                      {formatCurrency(t.iva_neto)}
                    </td>
                  </tr>

                  {/* Separator */}
                  <tr className="border-b border-gray-300">
                    <td colSpan={filteredMonths.length + 2} className="py-1" />
                  </tr>

                  {/* Renta Estimada */}
                  <tr className="bg-purple-50 font-bold">
                    <td className="px-4 py-3 text-purple-900 sticky left-0 bg-purple-50">
                      Renta Estimada (35%)
                    </td>
                    {filteredMonths.map((m) => (
                      <td key={m.month} className="px-3 py-3 text-right text-purple-800">
                        {formatCurrency(m.renta_estimada)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right text-purple-900 bg-purple-100">
                      {formatCurrency(t.renta_estimada)}
                    </td>
                  </tr>

                  {/* Invoices count */}
                  <tr className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-400 italic text-xs sticky left-0 bg-white">
                      # Facturas
                    </td>
                    {filteredMonths.map((m) => (
                      <td key={m.month} className="px-3 py-2 text-right text-gray-400 text-xs">
                        {m.invoices_count}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right text-gray-500 text-xs bg-gray-50 font-semibold">
                      {t.invoices_count}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Revenue by Supplier — Expandable */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
            <button
              onClick={() => setShowVentas(!showVentas)}
              className="w-full px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <h2 className="text-sm font-semibold text-gray-700">
                  Ventas por Proveedor ({data.ventas_by_supplier.length} proveedores)
                </h2>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(t.ventas_brutas)}</span>
                {showVentas ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </div>
            </button>
            {showVentas && (
              <div className="divide-y divide-gray-100">
                {data.ventas_by_supplier.map((supplier) => (
                  <SupplierRevenueRow
                    key={supplier.supplier_name}
                    supplier={supplier}
                    totalRevenue={t.ventas_brutas}
                    yearFilter={yearFilter}
                  />
                ))}
                <div className="px-4 py-3 bg-gray-50 flex justify-between font-semibold text-sm">
                  <span className="text-gray-900">TOTAL VENTAS</span>
                  <span className="text-gray-900">
                    {formatCurrency(data.ventas_by_supplier.reduce((s, sup) => s + sup.total, 0))}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Expense Detail — Expandable Groups */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
            <button
              onClick={() => setShowGastos(!showGastos)}
              className="w-full px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <TrendingDown className="w-4 h-4 text-orange-500" />
                <h2 className="text-sm font-semibold text-gray-700">
                  Detalle de Gastos ({data.gastos_groups.reduce((s, g) => s + g.entries, 0)} registros de {data.gastos_groups.length} grupos)
                </h2>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(t.total_gastos)}</span>
                {showGastos ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </div>
            </button>
            {showGastos && (
              <div className="divide-y divide-gray-100">
                {data.gastos_groups.map((group) => (
                  <ExpenseGroupRow key={group.group} group={group} totalGastos={t.total_gastos} yearFilter={yearFilter} />
                ))}
                <div className="px-4 py-3 bg-gray-50 flex justify-between font-semibold text-sm">
                  <span className="text-gray-900">TOTAL GASTOS</span>
                  <span className="text-gray-900">{formatCurrency(data.gastos_groups.reduce((s, g) => s + g.total, 0))}</span>
                </div>
              </div>
            )}
          </div>

          {/* IVA Explanation (collapsible) */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
            <button
              onClick={() => setShowIva(!showIva)}
              className="w-full px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Info className="w-4 h-4 text-blue-500" />
                <h2 className="text-sm font-semibold text-gray-700">
                  Notas sobre el calculo
                </h2>
              </div>
              {showIva ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </button>
            {showIva && (
              <div className="px-4 py-4 text-sm text-gray-600 space-y-3">
                <div>
                  <p className="font-semibold text-gray-800">Ventas Netas</p>
                  <p>Subtotal de facturas (sin IVA) menos el total de notas credito del periodo.</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">Costo de Ventas</p>
                  <p>Cuenta PUC 6135 (Costo de Ventas - Comercio). Extraido de los comprobantes contables (journals) de Siigo.</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">Gastos</p>
                  <p>Cuentas PUC 51xx (Administracion), 52xx (Ventas), 53xx (No Operacionales/Financieros). Fuentes: comprobantes contables (CC) y facturas de compra (FC).</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">IVA</p>
                  <p><strong>Generado:</strong> IVA cobrado en facturas de venta. <strong>Descontable:</strong> IVA pagado en compras (cuenta PUC 2408, debito). <strong>Neto:</strong> Lo que se debe pagar a la DIAN.</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">Renta Estimada</p>
                  <p>35% sobre la utilidad operativa positiva. Es una estimacion simplificada que no incluye deducciones especiales, rentas exentas, renta presuntiva, ni anticipos de renta.</p>
                </div>
              </div>
            )}
          </div>

          {/* Data source info */}
          <p className="text-xs text-gray-400 mt-4">
            Fuentes: {data.data_counts.invoices} facturas, {data.data_counts.credit_notes} notas credito,{' '}
            {data.data_counts.journals} comprobantes contables, {data.data_counts.purchases} facturas de compra,{' '}
            {data.data_counts.cogs_items} items COGS, {data.data_counts.expense_items_journal + data.data_counts.expense_items_purchase} items gastos{' '}
            (CC: {data.data_counts.expense_items_journal}, FC: {data.data_counts.expense_items_purchase}),{' '}
            {data.data_counts.iva_items} items IVA.
          </p>
        </>
      ) : null}
    </div>
  );
}
