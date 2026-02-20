'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Calculator,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  Check,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  BookOpen,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import JournalModal from '@/components/JournalModal';

interface ProductRow {
  product_code: string;
  product_name: string;
  supplier_name: string;
  is_consignment: boolean;
  quantity_sold: number;
  revenue: number;
  iva: number;
  actual_cost: number;
  estimated_cost: number;
  difference: number;
  status: 'ok' | 'missing' | 'over' | 'under';
}

interface SupplierRow {
  supplier_name: string;
  is_consignment: boolean;
  products_count: number;
  missing_count: number;
  ok_count: number;
  over_count: number;
  under_count: number;
  revenue: number;
  actual_cost: number;
  estimated_cost: number;
  difference: number;
}

interface Totals {
  total_products: number;
  missing_count: number;
  ok_count: number;
  over_count: number;
  under_count: number;
  revenue: number;
  actual_cost: number;
  estimated_cost: number;
  difference: number;
  actual_margin_pct: number;
  estimated_margin_pct: number;
  corrected_cost: number;
  corrected_margin_pct: number;
}

interface CostosData {
  label: string;
  available_months: string[];
  products: ProductRow[];
  by_supplier: SupplierRow[];
  totals: Totals;
}

function monthLabelFull(yyyymm: string): string {
  const [y, m] = yyyymm.split('-');
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  return `${months[parseInt(m) - 1]} ${y}`;
}

const STATUS_CONFIG = {
  ok: { label: 'OK', bg: 'bg-green-100', text: 'text-green-700', icon: Check },
  missing: { label: 'Sin costo', bg: 'bg-red-100', text: 'text-red-700', icon: AlertTriangle },
  over: { label: 'Costo alto', bg: 'bg-orange-100', text: 'text-orange-700', icon: ArrowUp },
  under: { label: 'Costo bajo', bg: 'bg-blue-100', text: 'text-blue-700', icon: ArrowDown },
};

type FilterMode = 'month' | 'range';
type StatusFilter = 'all' | 'missing' | 'ok' | 'over' | 'under';

export default function CostosEstimadosPage() {
  const [data, setData] = useState<CostosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuppliers, setShowSuppliers] = useState(true);
  const [sortBy, setSortBy] = useState<'revenue' | 'estimated_cost' | 'actual_cost' | 'difference'>('revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [costOverrides, setCostOverrides] = useState<Record<string, number>>({});

  const loadData = useCallback(async (params?: string) => {
    setLoading(true);
    setError('');
    try {
      const url = params ? `/api/dashboard/costos-estimados?${params}` : '/api/dashboard/costos-estimados';
      const res = await fetch(url);
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

  function handleFilter() {
    if (filterMode === 'month' && selectedMonth) {
      loadData(`month=${selectedMonth}`);
    } else if (filterMode === 'range' && startMonth && endMonth) {
      loadData(`start=${startMonth}&end=${endMonth}`);
    } else {
      loadData();
    }
  }

  function handleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  }

  const sortInd = (col: string) => sortBy === col ? (sortDir === 'desc' ? ' ▼' : ' ▲') : '';

  function toggleProduct(code: string) {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function toggleAllFiltered() {
    const filteredCodes = filtered.map(p => p.product_code);
    const allSelected = filteredCodes.length > 0 && filteredCodes.every(c => selectedProducts.has(c));
    if (allSelected) {
      setSelectedProducts(prev => {
        const next = new Set(prev);
        filteredCodes.forEach(c => next.delete(c));
        return next;
      });
    } else {
      setSelectedProducts(prev => {
        const next = new Set(prev);
        filteredCodes.forEach(c => next.add(c));
        return next;
      });
    }
  }

  function getEffectiveCost(code: string, original: number): number {
    return costOverrides[code] ?? original;
  }

  function selectAllMissing() {
    const missingCodes = (data?.products || [])
      .filter(p => p.status === 'missing')
      .map(p => p.product_code);
    setSelectedProducts(new Set(missingCodes));
  }

  // Filtered products
  const filtered = (data?.products || [])
    .filter((p) => {
      if (supplierFilter !== 'all' && p.supplier_name !== supplierFilter) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (searchTerm) {
        const t = searchTerm.toLowerCase();
        return p.product_code.toLowerCase().includes(t) || p.product_name.toLowerCase().includes(t) || p.supplier_name.toLowerCase().includes(t);
      }
      return true;
    })
    .sort((a, b) => {
      const mul = sortDir === 'desc' ? -1 : 1;
      return mul * ((a[sortBy] as number) - (b[sortBy] as number));
    });

  const filteredTotals = filtered.reduce(
    (acc, p) => {
      const eCost = getEffectiveCost(p.product_code, p.estimated_cost);
      return {
        revenue: acc.revenue + p.revenue,
        actual: acc.actual + p.actual_cost,
        estimated: acc.estimated + eCost,
        diff: acc.diff + (eCost - p.actual_cost),
      };
    },
    { revenue: 0, actual: 0, estimated: 0, diff: 0 }
  );

  const suppliers = data ? [...new Set(data.products.map((p) => p.supplier_name))].sort() : [];
  const t = data?.totals;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Calculator className="w-8 h-8 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Costos Estimados</h1>
            <p className="text-gray-500">
              {data ? data.label : 'Cargando...'} — Costo = Subtotal x 0.7 (margen 30%)
            </p>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center flex-wrap gap-3">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button type="button" onClick={() => setFilterMode('month')}
              className={`px-3 py-2 text-sm ${filterMode === 'month' ? 'bg-amber-100 text-amber-800 font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Por Mes
            </button>
            <button type="button" onClick={() => setFilterMode('range')}
              className={`px-3 py-2 text-sm border-l border-gray-300 ${filterMode === 'range' ? 'bg-amber-100 text-amber-800 font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Rango
            </button>
          </div>

          {filterMode === 'month' ? (
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="">Mes actual</option>
              {(data?.available_months || []).map((m) => (
                <option key={m} value={m}>{monthLabelFull(m)}</option>
              ))}
            </select>
          ) : (
            <>
              <select value={startMonth} onChange={(e) => setStartMonth(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                <option value="">Desde...</option>
                {(data?.available_months || []).slice().reverse().map((m) => (
                  <option key={m} value={m}>{monthLabelFull(m)}</option>
                ))}
              </select>
              <span className="text-gray-400 text-sm">a</span>
              <select value={endMonth} onChange={(e) => setEndMonth(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                <option value="">Hasta...</option>
                {(data?.available_months || []).map((m) => (
                  <option key={m} value={m}>{monthLabelFull(m)}</option>
                ))}
              </select>
            </>
          )}

          <button type="button" onClick={handleFilter} disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Consultar</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
      )}

      {loading && !data ? (
        <div className="text-center py-12 text-gray-500">Cargando costos estimados...</div>
      ) : data && t ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Ingreso (sin IVA)</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(t.revenue)}</p>
              <p className="text-xs text-gray-400">{t.total_products} productos</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Costo Real (Siigo)</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(t.actual_cost)}</p>
              <p className="text-xs text-gray-400">Margen real: {t.actual_margin_pct.toFixed(1)}%</p>
            </div>
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
              <p className="text-xs text-amber-600 mb-1">Costo Estimado (70%)</p>
              <p className="text-lg font-bold text-amber-900">{formatCurrency(t.estimated_cost)}</p>
              <p className="text-xs text-amber-400">Margen estimado: 30.0%</p>
            </div>
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
              <p className="text-xs text-blue-600 mb-1">Costo Corregido</p>
              <p className="text-lg font-bold text-blue-900">{formatCurrency(t.corrected_cost)}</p>
              <p className="text-xs text-blue-400">
                Real + estimado donde falta = margen {t.corrected_margin_pct.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Status breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {([
              { key: 'missing' as const, count: t.missing_count, label: 'Sin Costo', color: 'red' },
              { key: 'ok' as const, count: t.ok_count, label: 'Costo OK (±15%)', color: 'green' },
              { key: 'under' as const, count: t.under_count, label: 'Costo Bajo (<85%)', color: 'blue' },
              { key: 'over' as const, count: t.over_count, label: 'Costo Alto (>115%)', color: 'orange' },
            ]).map((s) => (
              <button key={s.key} type="button"
                onClick={() => setStatusFilter(statusFilter === s.key ? 'all' : s.key)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  statusFilter === s.key
                    ? `bg-${s.color}-100 border-${s.color}-300 ring-2 ring-${s.color}-300`
                    : `bg-${s.color}-50 border-${s.color}-200 hover:bg-${s.color}-100`
                }`}>
                <p className={`text-xs text-${s.color}-600 mb-1`}>{s.label}</p>
                <p className={`text-2xl font-bold text-${s.color}-900`}>{s.count}</p>
              </button>
            ))}
          </div>

          {/* Supplier Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
            <button type="button" onClick={() => setShowSuppliers(prev => !prev)}
              className="w-full px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors">
              <h2 className="text-sm font-semibold text-gray-700">Por Proveedor ({data.by_supplier.length})</h2>
              {showSuppliers ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
            </button>
            {showSuppliers && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Proveedor</th>
                      <th className="text-center px-2 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                      <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Prods</th>
                      <th className="text-right px-3 py-3 text-xs font-semibold text-red-500 uppercase">Sin C.</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">C. Real</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-amber-600 uppercase">C. Est. 70%</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.by_supplier.map((s) => (
                      <tr key={s.supplier_name}
                        className={`hover:bg-gray-50 cursor-pointer ${supplierFilter === s.supplier_name ? 'bg-amber-50' : ''}`}
                        onClick={() => setSupplierFilter(supplierFilter === s.supplier_name ? 'all' : s.supplier_name)}>
                        <td className="px-4 py-2 font-medium text-gray-900">{s.supplier_name}</td>
                        <td className="px-2 py-2 text-center">
                          {s.is_consignment
                            ? <span className="px-1.5 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">Cons.</span>
                            : <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">Prop.</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">{s.products_count}</td>
                        <td className="px-3 py-2 text-right">
                          {s.missing_count > 0
                            ? <span className="text-red-700 font-medium">{s.missing_count}</span>
                            : <span className="text-green-600">0</span>}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(s.revenue)}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(s.actual_cost)}</td>
                        <td className="px-4 py-2 text-right text-amber-700">{formatCurrency(s.estimated_cost)}</td>
                        <td className={`px-4 py-2 text-right font-medium ${s.difference > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {s.difference > 0 ? '+' : ''}{formatCurrency(s.difference)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-4 py-3 text-gray-900">TOTAL</td>
                      <td />
                      <td className="px-3 py-3 text-right text-gray-900">{t.total_products}</td>
                      <td className="px-3 py-3 text-right text-red-700">{t.missing_count}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(t.revenue)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(t.actual_cost)}</td>
                      <td className="px-4 py-3 text-right text-amber-700">{formatCurrency(t.estimated_cost)}</td>
                      <td className={`px-4 py-3 text-right ${t.difference > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {t.difference > 0 ? '+' : ''}{formatCurrency(t.difference)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Search / Filter bar */}
          <div className="flex items-center flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-[400px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Buscar codigo, nombre o proveedor..."
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="all">Todos los proveedores</option>
              {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="all">Todos los estados</option>
              <option value="missing">Sin Costo</option>
              <option value="ok">Costo OK</option>
              <option value="under">Costo Bajo</option>
              <option value="over">Costo Alto</option>
            </select>
            {(supplierFilter !== 'all' || statusFilter !== 'all' || searchTerm) && (
              <button type="button"
                onClick={() => { setSupplierFilter('all'); setStatusFilter('all'); setSearchTerm(''); }}
                className="text-sm text-amber-700 hover:underline">Limpiar</button>
            )}
            <span className="text-xs text-gray-400 ml-auto">{filtered.length} productos</span>
          </div>

          {/* Selection action bar */}
          {selectedProducts.size > 0 && (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-amber-900">
                  {selectedProducts.size} producto(s) seleccionado(s)
                </span>
                <button type="button" onClick={selectAllMissing}
                  className="text-xs text-amber-700 hover:underline">
                  Seleccionar todos sin costo ({data?.totals.missing_count || 0})
                </button>
                <button type="button" onClick={() => setSelectedProducts(new Set())}
                  className="text-xs text-gray-500 hover:underline">
                  Limpiar seleccion
                </button>
              </div>
              <button type="button" onClick={() => setShowJournalModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium">
                <BookOpen className="w-4 h-4" />
                Crear Comprobante Contable
              </button>
            </div>
          )}

          {/* Product Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-center px-2 py-3 w-10" aria-label="Seleccionar">
                      <input
                        type="checkbox"
                        title="Seleccionar todos"
                        checked={filtered.length > 0 && filtered.every(p => selectedProducts.has(p.product_code))}
                        onChange={toggleAllFiltered}
                        className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                      />
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Codigo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Producto</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Proveedor</th>
                    <th className="text-center px-2 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Cant.</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('revenue')}>
                      Subtotal{sortInd('revenue')}
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('actual_cost')}>
                      C. Real{sortInd('actual_cost')}
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-amber-600 uppercase cursor-pointer hover:text-amber-700"
                      onClick={() => handleSort('estimated_cost')}>
                      C. Est. 70%{sortInd('estimated_cost')}
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('difference')}>
                      Dif.{sortInd('difference')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-8 text-gray-500">No hay productos</td></tr>
                  ) : (
                    <>
                      {filtered.map((p) => {
                        const cfg = STATUS_CONFIG[p.status];
                        const StatusIcon = cfg.icon;
                        return (
                          <tr key={p.product_code} className={`hover:bg-gray-50 ${selectedProducts.has(p.product_code) ? 'bg-amber-50/50' : ''}`}>
                            <td className="px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                title={`Seleccionar ${p.product_code}`}
                                checked={selectedProducts.has(p.product_code)}
                                onChange={() => toggleProduct(p.product_code)}
                                className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                              />
                            </td>
                            <td className="px-4 py-2 font-mono text-xs text-gray-500">{p.product_code}</td>
                            <td className="px-4 py-2 text-gray-900 max-w-[200px] truncate" title={p.product_name}>
                              {p.product_name}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              <span className={`inline-block px-1.5 py-0.5 rounded ${p.is_consignment ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                                {p.supplier_name}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${cfg.bg} ${cfg.text}`}>
                                <StatusIcon className="w-3 h-3" />
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600">{Math.round(p.quantity_sold)}</td>
                            <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(p.revenue)}</td>
                            <td className="px-4 py-2 text-right">
                              {p.actual_cost > 0
                                ? <span className="text-gray-900">{formatCurrency(p.actual_cost)}</span>
                                : <span className="text-gray-300">$0</span>}
                            </td>
                            <td className="px-1 py-1 text-right">
                              <input
                                type="number"
                                title={`Costo estimado ${p.product_code}`}
                                value={Math.round(getEffectiveCost(p.product_code, p.estimated_cost))}
                                onChange={e => setCostOverrides(prev => ({
                                  ...prev,
                                  [p.product_code]: Math.round(Number(e.target.value) || 0),
                                }))}
                                className={`w-28 text-right px-2 py-1 text-sm border rounded font-mono
                                  ${costOverrides[p.product_code] !== undefined && costOverrides[p.product_code] !== Math.round(p.estimated_cost)
                                    ? 'border-amber-400 bg-amber-50 text-amber-900 font-medium'
                                    : 'border-gray-200 text-amber-700'
                                  } focus:ring-1 focus:ring-amber-500 focus:border-amber-500`}
                                min={0}
                              />
                            </td>
                            {(() => {
                              const eCost = getEffectiveCost(p.product_code, p.estimated_cost);
                              const diff = eCost - p.actual_cost;
                              return (
                                <td className={`px-4 py-2 text-right text-xs ${
                                  diff > 1000 ? 'text-red-600' : diff < -1000 ? 'text-green-600' : 'text-gray-400'
                                }`}>
                                  {p.actual_cost === 0
                                    ? <span className="text-red-500 font-medium">+{formatCurrency(eCost)}</span>
                                    : `${diff > 0 ? '+' : ''}${formatCurrency(diff)}`}
                                </td>
                              );
                            })()}
                          </tr>
                        );
                      })}
                      <tr className="bg-gray-50 font-semibold border-t border-gray-200">
                        <td className="px-4 py-3 text-gray-900" colSpan={6}>
                          TOTAL ({filtered.length} productos)
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(filteredTotals.revenue)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(filteredTotals.actual)}</td>
                        <td className="px-4 py-3 text-right text-amber-700">{formatCurrency(filteredTotals.estimated)}</td>
                        <td className={`px-4 py-3 text-right ${filteredTotals.diff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {filteredTotals.diff > 0 ? '+' : ''}{formatCurrency(filteredTotals.diff)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Formula explanation */}
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <p className="text-sm text-amber-900 font-medium mb-2">Formula de Calculo</p>
            <div className="text-xs text-amber-800 space-y-1">
              <p><strong>Costo Estimado = Subtotal (sin IVA) x 0.70</strong></p>
              <p>Basado en: Precio de Venta = Costo / 0.70, por lo tanto Costo = Precio x 0.70 (margen bruto del 30%).</p>
              <p className="mt-2"><strong>Estados:</strong></p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li><span className="text-red-700 font-medium">Sin costo:</span> No hay comprobante contable (6135) para este producto. Necesita correccion en Siigo.</li>
                <li><span className="text-green-700 font-medium">OK:</span> El costo real esta dentro del ±15% del estimado.</li>
                <li><span className="text-blue-700 font-medium">Costo Bajo:</span> El costo real es menor al 85% del estimado (margen mayor al esperado).</li>
                <li><span className="text-orange-700 font-medium">Costo Alto:</span> El costo real supera el 115% del estimado (margen menor al esperado).</li>
              </ul>
              <p className="mt-2"><strong>Diferencia (columna Dif.):</strong> Costo Estimado - Costo Real. Positivo = falta costo por registrar.</p>
            </div>
          </div>
        </>
      ) : null}

      {/* Journal creation modal */}
      {showJournalModal && data && (
        <JournalModal
          products={data.products
            .filter(p => selectedProducts.has(p.product_code))
            .map(p => ({
              ...p,
              estimated_cost: getEffectiveCost(p.product_code, p.estimated_cost),
            }))}
          defaultDate={(() => {
            const m = selectedMonth || data.label;
            if (/^\d{4}-\d{2}$/.test(m)) {
              const [y, mo] = m.split('-').map(Number);
              const lastDay = new Date(y, mo, 0).getDate();
              return `${y}-${String(mo).padStart(2, '0')}-${lastDay}`;
            }
            return new Date().toISOString().split('T')[0];
          })()}
          onClose={() => setShowJournalModal(false)}
          onSuccess={() => {
            setShowJournalModal(false);
            setSelectedProducts(new Set());
            handleFilter();
          }}
        />
      )}
    </div>
  );
}
