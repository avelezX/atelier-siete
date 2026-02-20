'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Search,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface ZeroCostProduct {
  product_code: string;
  product_name: string;
  supplier_name: string;
  is_consignment: boolean;
  quantity_sold: number;
  revenue: number;
  iva: number;
  revenue_with_iva: number;
  estimated_cost_70: number;
  invoices_count: number;
  months_sold: string[];
  customers: string[];
}

interface SupplierRow {
  supplier_name: string;
  is_consignment: boolean;
  products_count: number;
  revenue: number;
  estimated_cost: number;
  quantity: number;
}

interface MonthRow {
  month: string;
  zero_cost_revenue: number;
  zero_cost_products: number;
  total_revenue: number;
  total_products: number;
  pct_zero: number;
}

interface Totals {
  zero_cost_products: number;
  zero_cost_revenue: number;
  estimated_cost_70: number;
  total_products_sold: number;
  total_revenue: number;
  pct_zero_revenue: number;
  products_with_cogs: number;
}

interface CostoCeroData {
  label: string;
  available_months: string[];
  products: ZeroCostProduct[];
  by_supplier: SupplierRow[];
  by_month: MonthRow[];
  totals: Totals;
}

function monthLabel(yyyymm: string): string {
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

type FilterMode = 'month' | 'range';

export default function CostoCeroPage() {
  const [data, setData] = useState<CostoCeroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'consignment' | 'own'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showMonthly, setShowMonthly] = useState(false);
  const [sortBy, setSortBy] = useState<'revenue' | 'quantity_sold' | 'estimated_cost_70' | 'invoices_count'>('revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const loadData = useCallback(async (params?: string) => {
    setLoading(true);
    setError('');
    try {
      const url = params ? `/api/dashboard/costo-cero?${params}` : '/api/dashboard/costo-cero';
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
    if (sortBy === col) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  }

  const sortIndicator = (col: string) =>
    sortBy === col ? (sortDir === 'desc' ? ' ▼' : ' ▲') : '';

  // Filtered products
  const filteredProducts = (data?.products || [])
    .filter((p) => {
      if (supplierFilter !== 'all' && p.supplier_name !== supplierFilter) return false;
      if (typeFilter === 'consignment' && p.is_consignment === false) return false;
      if (typeFilter === 'own' && p.is_consignment === true) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          p.product_code.toLowerCase().includes(term) ||
          p.product_name.toLowerCase().includes(term) ||
          p.supplier_name.toLowerCase().includes(term)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const mul = sortDir === 'desc' ? -1 : 1;
      return mul * ((a[sortBy] as number) - (b[sortBy] as number));
    });

  const filteredTotals = filteredProducts.reduce(
    (acc, p) => ({
      revenue: acc.revenue + p.revenue,
      estimated: acc.estimated + p.estimated_cost_70,
      quantity: acc.quantity + p.quantity_sold,
    }),
    { revenue: 0, estimated: 0, quantity: 0 }
  );

  const suppliers = data ? [...new Set(data.products.map((p) => p.supplier_name))].sort() : [];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Productos Costo Cero</h1>
            <p className="text-gray-500">
              {data ? data.label : 'Cargando...'}
              {data ? ` — ${data.totals.zero_cost_products} productos sin costo` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center flex-wrap gap-3">
          {/* Mode toggle */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              type="button"
              onClick={() => setFilterMode('month')}
              className={`px-3 py-2 text-sm ${filterMode === 'month' ? 'bg-amber-100 text-amber-800 font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              Por Mes
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('range')}
              className={`px-3 py-2 text-sm border-l border-gray-300 ${filterMode === 'range' ? 'bg-amber-100 text-amber-800 font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              Rango
            </button>
          </div>

          {filterMode === 'month' ? (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">Ultimos 12 meses</option>
              {(data?.available_months || []).map((m) => (
                <option key={m} value={m}>{monthLabelFull(m)}</option>
              ))}
            </select>
          ) : (
            <>
              <select
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="">Desde...</option>
                {(data?.available_months || []).slice().reverse().map((m) => (
                  <option key={m} value={m}>{monthLabelFull(m)}</option>
                ))}
              </select>
              <span className="text-gray-400 text-sm">a</span>
              <select
                value={endMonth}
                onChange={(e) => setEndMonth(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="">Hasta...</option>
                {(data?.available_months || []).map((m) => (
                  <option key={m} value={m}>{monthLabelFull(m)}</option>
                ))}
              </select>
            </>
          )}

          <button
            type="button"
            onClick={handleFilter}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Consultar</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {loading && data === null ? (
        <div className="text-center py-12 text-gray-500">
          Cargando datos...
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-red-50 rounded-xl border border-red-200 p-4">
              <p className="text-xs text-red-600 mb-1">Sin Costo</p>
              <p className="text-xl font-bold text-red-900">{data.totals.zero_cost_products}</p>
              <p className="text-xs text-red-400">productos</p>
            </div>
            <div className="bg-red-50 rounded-xl border border-red-200 p-4">
              <p className="text-xs text-red-600 mb-1">Revenue Sin Costo</p>
              <p className="text-lg font-bold text-red-900">{formatCurrency(data.totals.zero_cost_revenue)}</p>
              <p className="text-xs text-red-400">{data.totals.pct_zero_revenue.toFixed(1)}% del total</p>
            </div>
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
              <p className="text-xs text-amber-600 mb-1">Costo Estimado (70%)</p>
              <p className="text-lg font-bold text-amber-900">{formatCurrency(data.totals.estimated_cost_70)}</p>
              <p className="text-xs text-amber-400">si margen fuera 30%</p>
            </div>
            <div className="bg-green-50 rounded-xl border border-green-200 p-4">
              <p className="text-xs text-green-600 mb-1">Con Costo</p>
              <p className="text-xl font-bold text-green-900">{data.totals.products_with_cogs}</p>
              <p className="text-xs text-green-400">productos</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Total Vendidos</p>
              <p className="text-xl font-bold text-gray-900">{data.totals.total_products_sold}</p>
              <p className="text-xs text-gray-400">productos unicos</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Revenue Total</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(data.totals.total_revenue)}</p>
            </div>
          </div>

          {/* By Supplier Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">
                Costo Cero por Proveedor ({data.by_supplier.length} proveedores)
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Proveedor</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Productos</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Costo Est. 70%</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase">% del total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.by_supplier.map((s) => (
                  <tr
                    key={s.supplier_name}
                    className={`hover:bg-gray-50 cursor-pointer ${supplierFilter === s.supplier_name ? 'bg-amber-50' : ''}`}
                    onClick={() => setSupplierFilter(supplierFilter === s.supplier_name ? 'all' : s.supplier_name)}
                  >
                    <td className="px-4 py-2 font-medium text-gray-900">{s.supplier_name}</td>
                    <td className="px-3 py-2 text-center">
                      {s.is_consignment ? (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">Consig.</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">Propio</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">{s.products_count}</td>
                    <td className="px-4 py-2 text-right text-red-700 font-medium">{formatCurrency(s.revenue)}</td>
                    <td className="px-4 py-2 text-right text-amber-700">{formatCurrency(s.estimated_cost)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">
                      {data.totals.zero_cost_revenue > 0
                        ? ((s.revenue / data.totals.zero_cost_revenue) * 100).toFixed(1) + '%'
                        : '0%'}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-3 text-gray-900">TOTAL</td>
                  <td />
                  <td className="px-3 py-3 text-right text-gray-900">
                    {data.by_supplier.reduce((s, r) => s + r.products_count, 0)}
                  </td>
                  <td className="px-4 py-3 text-right text-red-700">{formatCurrency(data.totals.zero_cost_revenue)}</td>
                  <td className="px-4 py-3 text-right text-amber-700">{formatCurrency(data.totals.estimated_cost_70)}</td>
                  <td className="px-3 py-3 text-right text-gray-500">100%</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Monthly Breakdown (collapsible) */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
            <button
              type="button"
              onClick={() => setShowMonthly(prev => !prev)}
              className="w-full px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
            >
              <h2 className="text-sm font-semibold text-gray-700">
                Evolucion Mensual del Costo Cero
              </h2>
              {showMonthly ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
            </button>
            {showMonthly && (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Mes</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Rev. Sin Costo</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Rev. Total</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase">% Sin Costo</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Prods 0</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Prods Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.by_month.map((m) => (
                    <tr key={m.month} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">{monthLabel(m.month)}</td>
                      <td className="px-4 py-2 text-right text-red-700">{formatCurrency(m.zero_cost_revenue)}</td>
                      <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(m.total_revenue)}</td>
                      <td className={`px-3 py-2 text-right font-medium ${m.pct_zero > 50 ? 'text-red-700' : m.pct_zero > 20 ? 'text-amber-700' : 'text-green-700'}`}>
                        {m.pct_zero.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2 text-right text-red-600">{m.zero_cost_products}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{m.total_products}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Product search and filters */}
          <div className="flex items-center flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-[400px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por codigo, nombre o proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="all">Todos los proveedores</option>
              {suppliers.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              {[
                { key: 'all' as const, label: 'Todos' },
                { key: 'consignment' as const, label: 'Consignacion' },
                { key: 'own' as const, label: 'Propios' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setTypeFilter(tab.key)}
                  className={`px-3 py-2 text-sm ${tab.key !== 'all' ? 'border-l border-gray-300' : ''} ${
                    typeFilter === tab.key
                      ? 'bg-amber-100 text-amber-800 font-medium'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {(supplierFilter !== 'all' || typeFilter !== 'all' || searchTerm) && (
              <button
                type="button"
                onClick={() => { setSupplierFilter('all'); setTypeFilter('all'); setSearchTerm(''); }}
                className="text-sm text-amber-700 hover:underline"
              >
                Limpiar filtros
              </button>
            )}
            <span className="text-xs text-gray-400 ml-auto">
              {filteredProducts.length} productos
            </span>
          </div>

          {/* Product Detail Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Codigo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Producto</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Proveedor</th>
                    <th
                      className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('quantity_sold')}
                    >
                      Cant.{sortBy === 'quantity_sold' ? sortIndicator('quantity_sold') : ''}
                    </th>
                    <th
                      className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('revenue')}
                    >
                      Revenue{sortIndicator('revenue')}
                    </th>
                    <th
                      className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('estimated_cost_70')}
                    >
                      Est. Costo 70%{sortIndicator('estimated_cost_70')}
                    </th>
                    <th
                      className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('invoices_count')}
                    >
                      Facturas{sortIndicator('invoices_count')}
                    </th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Meses</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-gray-500">
                        No hay productos sin costo para este periodo
                      </td>
                    </tr>
                  ) : (
                    <>
                      {filteredProducts.map((p) => (
                        <tr key={p.product_code} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-mono text-xs text-gray-500">{p.product_code}</td>
                          <td className="px-4 py-2 text-gray-900 max-w-[220px] truncate" title={p.product_name}>
                            {p.product_name}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            <span className={`inline-block px-1.5 py-0.5 rounded ${p.is_consignment ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                              {p.supplier_name}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {Math.round(p.quantity_sold)}
                          </td>
                          <td className="px-4 py-2 text-right text-red-700 font-medium">
                            {formatCurrency(p.revenue)}
                          </td>
                          <td className="px-4 py-2 text-right text-amber-700">
                            {formatCurrency(p.estimated_cost_70)}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {p.invoices_count}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-400">
                            {p.months_sold.length <= 3
                              ? p.months_sold.map(monthLabel).join(', ')
                              : `${p.months_sold.length} meses`}
                          </td>
                        </tr>
                      ))}
                      {/* Totals */}
                      <tr className="bg-gray-50 font-semibold border-t border-gray-200">
                        <td className="px-4 py-3 text-gray-900" colSpan={3}>
                          TOTAL ({filteredProducts.length} productos)
                        </td>
                        <td className="px-3 py-3 text-right text-gray-900">
                          {Math.round(filteredTotals.quantity)}
                        </td>
                        <td className="px-4 py-3 text-right text-red-700">
                          {formatCurrency(filteredTotals.revenue)}
                        </td>
                        <td className="px-4 py-3 text-right text-amber-700">
                          {formatCurrency(filteredTotals.estimated)}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Help note */}
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <p className="text-sm text-amber-900 font-medium mb-2">Como corregir los costos en Siigo</p>
            <ul className="text-xs text-amber-800 space-y-1 list-disc pl-4">
              <li>Estos productos fueron vendidos pero no tienen comprobante contable (CC) con cuenta PUC 6135 (Costo de Ventas) en el periodo seleccionado.</li>
              <li>Para productos <strong>propios</strong>: verificar en Siigo que tengan <em>control de inventario</em> activo y que exista la entrada de compra/remision.</li>
              <li>Para productos de <strong>consignacion</strong>: el costo normalmente se registra cuando se liquida al proveedor. Verificar que la liquidacion se haya generado.</li>
              <li>El <strong>Costo Estimado (70%)</strong> asume un margen del 30% sobre el subtotal. Usar como referencia para validar los montos al corregir.</li>
              <li>Despues de corregir en Siigo, ejecutar <strong>Sincronizacion</strong> para actualizar los datos aqui.</li>
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}
