'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  RefreshCw,
  Search,
  Check,
  AlertTriangle,
  BookOpen,
  Link2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import JournalModal from '@/components/JournalModal';

/* ─── Types ─── */

interface ProductRow {
  product_code: string;
  product_name: string;
  supplier_name: string;
  purchase_supplier: string | null;
  sale_price: number;
  sale_month: string;
  quantity_sold: number;
  revenue: number;
  has_journal: boolean;
  journal_cost: number;
  purchase_cost: number;
  purchase_qty: number;
  cost_source: 'purchase' | 'journal' | 'none';
  estimated_cost: number;
  resolved_cost: number;
  margin_pct: number;
}

interface Summary {
  total_products: number;
  total_rows: number;
  with_purchase_cost: number;
  with_journal_cost: number;
  with_no_cost: number;
  total_revenue: number;
  revenue_with_cost: number;
  revenue_no_cost: number;
}

interface CostTrackingData {
  range: { start: string; end: string };
  summary: Summary;
  products: ProductRow[];
}

/* ─── Helpers ─── */

function rowKey(p: ProductRow): string {
  return `${p.product_code}::${p.sale_month}`;
}

function marginColor(pct: number): string {
  if (pct >= 40) return 'text-green-700';
  if (pct >= 20) return 'text-green-600';
  if (pct >= 0) return 'text-amber-600';
  return 'text-red-600';
}

const MONTH_NAMES: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
};

function formatMonth(ym: string): string {
  const [y, m] = ym.split('-');
  return `${MONTH_NAMES[m] || m} ${y}`;
}

/** Last day of a YYYY-MM month */
function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 0).getDate();
  return `${ym}-${String(d).padStart(2, '0')}`;
}

const SOURCE_CONFIG = {
  purchase: { label: 'Factura Compra', bg: 'bg-green-100', text: 'text-green-700', icon: Link2 },
  journal: { label: 'Comprobante', bg: 'bg-blue-100', text: 'text-blue-700', icon: BookOpen },
  none: { label: 'Sin costo', bg: 'bg-red-100', text: 'text-red-700', icon: AlertTriangle },
};

/* ─── Component ─── */

export default function CostTrackingPage() {
  const [data, setData] = useState<CostTrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startMonth, setStartMonth] = useState('2025-06');
  const [endMonth, setEndMonth] = useState('2025-12');
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [costOverrides, setCostOverrides] = useState<Record<string, number>>({});
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [showPurchase, setShowPurchase] = useState(true);
  const [showJournal, setShowJournal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/dashboard/cost-tracking?start=${startMonth}&end=${endMonth}`);
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
  }, [startMonth, endMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  /* Selection helpers */
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
    const allSelected = keys.every(k => selected.has(k));
    setSelected(prev => {
      const next = new Set(prev);
      keys.forEach(k => allSelected ? next.delete(k) : next.add(k));
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

  /* Effective cost for a row */
  function getEffectiveCost(p: ProductRow): number {
    const key = rowKey(p);
    if (costOverrides[key] !== undefined) return costOverrides[key];
    if (p.cost_source === 'purchase') return p.purchase_cost;
    return p.estimated_cost;
  }

  /* ─── Derived data ─── */
  const allProducts = data?.products || [];

  // 3 buckets
  const purchaseRows = allProducts.filter(p => p.cost_source === 'purchase');
  const noCostRows = allProducts.filter(p => p.cost_source === 'none');
  const journalRows = allProducts.filter(p => p.cost_source === 'journal');

  const applyFilters = (list: ProductRow[]) =>
    list.filter(p => {
      if (supplierFilter !== 'all' && p.supplier_name !== supplierFilter) return false;
      if (searchTerm) {
        const t = searchTerm.toLowerCase();
        return p.product_code.toLowerCase().includes(t) ||
          p.product_name.toLowerCase().includes(t) ||
          p.supplier_name.toLowerCase().includes(t);
      }
      return true;
    });

  const filteredPurchase = applyFilters(purchaseRows);
  const filteredNoCost = applyFilters(noCostRows);
  const filteredJournal = applyFilters(journalRows);

  const suppliers = data ? [...new Set(allProducts.map(p => p.supplier_name))].filter(Boolean).sort() : [];

  // Count how many months will be affected
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
        status: p.cost_source === 'purchase' ? 'purchase' : 'missing',
        sale_month: p.sale_month,
      };
    });

  const s = data?.summary;

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Costos Reales</h1>
            <p className="text-sm text-gray-500">
              Resolver costos del 2025 H2 — Fecha del comprobante = mes de la venta
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
            Crear Comprobante ({selected.size} filas, {selectedMonths.size} mes{selectedMonths.size !== 1 ? 'es' : ''})
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label htmlFor="ct-start" className="block text-xs text-gray-500 mb-1">Desde</label>
          <input
            id="ct-start"
            type="text"
            placeholder="2025-06"
            value={startMonth}
            onChange={e => setStartMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28"
          />
        </div>
        <div>
          <label htmlFor="ct-end" className="block text-xs text-gray-500 mb-1">Hasta</label>
          <input
            id="ct-end"
            type="text"
            placeholder="2025-12"
            value={endMonth}
            onChange={e => setEndMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28"
          />
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="flex items-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Cargar</span>
        </button>
        <div className="flex-1" />
        <div className="relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar producto..."
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

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
      )}

      {loading && !data ? (
        <div className="text-center py-12 text-gray-500">Cargando datos...</div>
      ) : data && s ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Productos Unicos</p>
              <p className="text-2xl font-bold text-gray-900">{s.total_products}</p>
              <p className="text-xs text-gray-400">{s.total_rows} filas (producto×mes)</p>
            </div>
            <div className="bg-green-50 rounded-xl border border-green-200 p-4">
              <div className="flex items-center gap-1 mb-1">
                <Link2 className="w-3 h-3 text-green-600" />
                <p className="text-xs text-green-700">Con costo (factura compra)</p>
              </div>
              <p className="text-2xl font-bold text-green-700">{s.with_purchase_cost}</p>
            </div>
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
              <div className="flex items-center gap-1 mb-1">
                <BookOpen className="w-3 h-3 text-blue-600" />
                <p className="text-xs text-blue-700">Con comprobante existente</p>
              </div>
              <p className="text-2xl font-bold text-blue-700">{s.with_journal_cost}</p>
            </div>
            <div className="bg-red-50 rounded-xl border border-red-200 p-4">
              <div className="flex items-center gap-1 mb-1">
                <AlertTriangle className="w-3 h-3 text-red-600" />
                <p className="text-xs text-red-700">Sin costo</p>
              </div>
              <p className="text-2xl font-bold text-red-700">{s.with_no_cost}</p>
              <p className="text-xs text-red-500">{formatCurrency(s.revenue_no_cost)} en revenue</p>
            </div>
          </div>

          {/* ═══ SECTION 1: Purchase cost products (known cost, need comprobante) ═══ */}
          <div className="bg-white rounded-xl border border-green-200 overflow-hidden mb-6">
            <button
              type="button"
              onClick={() => setShowPurchase(!showPurchase)}
              className="w-full px-4 py-3 bg-green-50 border-b border-green-200 flex items-center justify-between hover:bg-green-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-green-600" />
                <h2 className="text-sm font-semibold text-green-800">
                  Costo por Factura de Compra ({filteredPurchase.length} filas)
                </h2>
                <span className="text-xs text-green-600">— Costo exacto del proveedor, falta comprobante</span>
              </div>
              <div className="flex items-center gap-2">
                {filteredPurchase.some(p => selected.has(rowKey(p))) && (
                  <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                    {filteredPurchase.filter(p => selected.has(rowKey(p))).length} seleccionados
                  </span>
                )}
                {showPurchase
                  ? <ChevronDown className="w-4 h-4 text-green-500" />
                  : <ChevronRight className="w-4 h-4 text-green-500" />}
              </div>
            </button>

            {showPurchase && (
              <>
                <div className="px-4 py-2 bg-green-50/50 border-b border-green-100 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => selectAll(filteredPurchase)}
                    className="px-3 py-1 text-xs text-green-700 border border-green-300 rounded-lg hover:bg-green-100"
                  >
                    Seleccionar todos
                  </button>
                  <span className="text-xs text-green-600">
                    El comprobante se creara con el costo exacto de la factura de compra
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="w-8 px-3 py-2">
                          <input
                            type="checkbox"
                            title="Seleccionar todos"
                            checked={filteredPurchase.length > 0 && filteredPurchase.every(p => selected.has(rowKey(p)))}
                            onChange={() => toggleAll(filteredPurchase)}
                            className="rounded border-gray-300"
                          />
                        </th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Mes Venta</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Codigo</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Producto</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Proveedor</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Uds</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">P. Venta</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-green-700 uppercase">Costo Real</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Margen</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredPurchase.map(p => {
                        const key = rowKey(p);
                        const isSelected = selected.has(key);
                        const margin = p.sale_price > 0 ? ((p.sale_price - p.purchase_cost) / p.sale_price) * 100 : 0;
                        return (
                          <tr key={key} className={`hover:bg-gray-50 ${isSelected ? 'bg-green-50/40' : ''}`}>
                            <td className="px-3 py-1.5 text-center">
                              <input
                                type="checkbox"
                                title={`Seleccionar ${p.product_code} ${p.sale_month}`}
                                checked={isSelected}
                                onChange={() => toggle(key)}
                                className="rounded border-gray-300"
                              />
                            </td>
                            <td className="px-3 py-1.5 text-xs font-medium text-gray-600">{formatMonth(p.sale_month)}</td>
                            <td className="px-3 py-1.5 font-mono text-xs text-gray-600">{p.product_code}</td>
                            <td className="px-3 py-1.5 text-gray-900 truncate max-w-[180px]" title={p.product_name}>{p.product_name}</td>
                            <td className="px-3 py-1.5 text-gray-500 text-xs">{p.supplier_name || '\u2014'}</td>
                            <td className="px-3 py-1.5 text-right text-gray-700">{p.quantity_sold}</td>
                            <td className="px-3 py-1.5 text-right text-gray-700">{formatCurrency(p.sale_price)}</td>
                            <td className="px-3 py-1.5 text-right text-green-700 font-semibold">{formatCurrency(p.purchase_cost)}</td>
                            <td className={`px-3 py-1.5 text-right font-semibold ${marginColor(margin)}`}>
                              {margin.toFixed(1)}%
                            </td>
                            <td className="px-3 py-1.5 text-right text-gray-900">{formatCurrency(p.revenue)}</td>
                          </tr>
                        );
                      })}
                      {filteredPurchase.length === 0 && (
                        <tr>
                          <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                            No se encontraron productos con costo de compra
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* ═══ SECTION 2: Products without cost (need estimation) ═══ */}
          <div className="bg-white rounded-xl border border-red-200 overflow-hidden mb-6">
            <div className="px-4 py-3 bg-red-50 border-b border-red-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <h2 className="text-sm font-semibold text-red-800">
                  Sin Costo — Necesitan Estimacion ({filteredNoCost.length} filas)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => selectAll(filteredNoCost)}
                className="px-3 py-1.5 text-xs text-red-700 border border-red-300 rounded-lg hover:bg-red-100"
              >
                Seleccionar todos
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-8 px-3 py-2">
                      <input
                        type="checkbox"
                        title="Seleccionar todos"
                        checked={filteredNoCost.length > 0 && filteredNoCost.every(p => selected.has(rowKey(p)))}
                        onChange={() => toggleAll(filteredNoCost)}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Mes Venta</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Codigo</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Producto</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Proveedor</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Uds</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">P. Venta</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Est. 70%</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-amber-700 uppercase">Costo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredNoCost.map(p => {
                    const key = rowKey(p);
                    const estimated = p.estimated_cost;
                    const current = costOverrides[key] ?? estimated;
                    const isModified = current !== estimated;
                    const isSelected = selected.has(key);
                    return (
                      <tr
                        key={key}
                        className={`hover:bg-gray-50 ${isSelected ? 'bg-amber-50/40' : ''}`}
                      >
                        <td className="px-3 py-1.5 text-center">
                          <input
                            type="checkbox"
                            title={`Seleccionar ${p.product_code} ${p.sale_month}`}
                            checked={isSelected}
                            onChange={() => toggle(key)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-xs font-medium text-gray-600">{formatMonth(p.sale_month)}</td>
                        <td className="px-3 py-1.5 font-mono text-xs text-gray-600">{p.product_code}</td>
                        <td className="px-3 py-1.5 text-gray-900 truncate max-w-[180px]" title={p.product_name}>{p.product_name}</td>
                        <td className="px-3 py-1.5 text-gray-500 text-xs">{p.supplier_name || '\u2014'}</td>
                        <td className="px-3 py-1.5 text-right text-gray-700">{p.quantity_sold}</td>
                        <td className="px-3 py-1.5 text-right text-gray-700">{formatCurrency(p.sale_price)}</td>
                        <td className="px-3 py-1.5 text-right text-gray-900 font-medium">{formatCurrency(p.revenue)}</td>
                        <td className="px-3 py-1.5 text-right text-gray-400 text-xs">{formatCurrency(estimated)}</td>
                        <td className="px-1 py-1 text-right">
                          <input
                            type="number"
                            title={`Costo para ${p.product_code} ${p.sale_month}`}
                            value={current}
                            onChange={e => setCostOverrides(prev => ({ ...prev, [key]: Math.round(Number(e.target.value) || 0) }))}
                            className={`w-28 text-right px-2 py-1 text-sm border rounded-md font-mono
                              ${isModified
                                ? 'border-amber-400 bg-amber-50 text-amber-900 font-medium'
                                : 'border-gray-200 text-gray-900'
                              } focus:ring-1 focus:ring-amber-500 focus:border-amber-500`}
                            min={0}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {filteredNoCost.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                        {noCostRows.length === 0
                          ? 'Todos los productos tienen costo resuelto'
                          : 'No se encontraron productos con los filtros actuales'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══ SECTION 3: Products with existing journal entries (info only) ═══ */}
          <div className="bg-white rounded-xl border border-blue-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowJournal(!showJournal)}
              className="w-full px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between hover:bg-blue-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-blue-800">
                  Con Comprobante Existente ({filteredJournal.length} filas)
                </h2>
                <span className="text-xs text-blue-500">— Ya tienen asiento contable en Siigo</span>
              </div>
              {showJournal
                ? <ChevronDown className="w-4 h-4 text-blue-400" />
                : <ChevronRight className="w-4 h-4 text-blue-400" />}
            </button>

            {showJournal && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Mes Venta</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Codigo</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Producto</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Proveedor</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Uds</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">P. Venta</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Costo</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Margen</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredJournal.map(p => {
                      const key = rowKey(p);
                      const displayCost = p.resolved_cost;
                      const margin = p.sale_price > 0 ? ((p.sale_price - displayCost) / p.sale_price) * 100 : 0;
                      return (
                        <tr key={key} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-xs font-medium text-gray-600">{formatMonth(p.sale_month)}</td>
                          <td className="px-3 py-2 font-mono text-xs text-gray-600">{p.product_code}</td>
                          <td className="px-3 py-2 text-gray-900 truncate max-w-[200px]" title={p.product_name}>{p.product_name}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{p.supplier_name || '\u2014'}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{p.quantity_sold}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(p.sale_price)}</td>
                          <td className="px-3 py-2 text-right text-gray-900 font-medium">{formatCurrency(displayCost)}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${marginColor(margin)}`}>
                            {margin.toFixed(1)}%
                          </td>
                          <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(p.revenue)}</td>
                        </tr>
                      );
                    })}
                    {filteredJournal.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                          No se encontraron productos con comprobante
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* Journal Modal */}
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
