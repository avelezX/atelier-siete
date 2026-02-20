'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  RefreshCw,
  Package,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface ProductRow {
  product_code: string;
  product_name: string;
  supplier_name: string;
  is_consignment: boolean;
  quantity_sold: number;
  revenue: number;
  iva: number;
  cogs: number;
  cogs_quantity: number;
  margin: number;
  margin_pct: number;
}

interface SupplierRow {
  supplier_name: string;
  is_consignment: boolean;
  revenue: number;
  cogs: number;
  margin: number;
  margin_pct: number;
  products_count: number;
}

interface Totals {
  quantity_sold: number;
  revenue: number;
  iva: number;
  cogs: number;
  margin: number;
  margin_pct: number;
}

interface MesData {
  month: string;
  products: ProductRow[];
  by_supplier: SupplierRow[];
  totals: Totals;
  counts: {
    invoices: number;
    invoice_items: number;
    cogs_items: number;
    products_with_sales: number;
    products_with_cogs: number;
  };
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
  if (total === 0) return '—';
  return ((value / total) * 100).toFixed(1) + '%';
}

function MesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const monthParam = searchParams.get('month') || '';

  const [data, setData] = useState<MesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSuppliers, setShowSuppliers] = useState(true);
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'revenue' | 'cogs' | 'margin' | 'margin_pct' | 'quantity'>('revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const loadData = useCallback(async () => {
    if (!monthParam) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/dashboard/resumen/mes?month=${monthParam}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [monthParam]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Navigate to adjacent months
  function goMonth(offset: number) {
    const [y, m] = monthParam.split('-').map(Number);
    const d = new Date(y, m - 1 + offset, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    router.push(`/resumen/mes?month=${newMonth}`);
  }

  // Sorting
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

  // Filtered and sorted products
  const filteredProducts = (data?.products || [])
    .filter((p) => supplierFilter === 'all' || p.supplier_name === supplierFilter)
    .sort((a, b) => {
      const mul = sortDir === 'desc' ? -1 : 1;
      const key = sortBy === 'quantity' ? 'quantity_sold' : sortBy;
      return mul * ((a[key] as number) - (b[key] as number));
    });

  const filteredTotals = filteredProducts.reduce(
    (acc, p) => ({
      quantity_sold: acc.quantity_sold + p.quantity_sold,
      revenue: acc.revenue + p.revenue,
      iva: acc.iva + p.iva,
      cogs: acc.cogs + p.cogs,
      margin: acc.margin + p.margin,
    }),
    { quantity_sold: 0, revenue: 0, iva: 0, cogs: 0, margin: 0 }
  );

  const suppliers = data ? [...new Set(data.products.map((p) => p.supplier_name))].sort() : [];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => router.push('/resumen')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <Package className="w-8 h-8 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Detalle Mensual
            </h1>
            <p className="text-gray-500">
              {monthParam ? monthLabelFull(monthParam) : 'Seleccione un mes'} — Ventas vs Costos por Producto
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
          >
            ← Mes anterior
          </button>
          <button
            type="button"
            onClick={() => goMonth(1)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
          >
            Mes siguiente →
          </button>
          <button
            type="button"
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
          Cargando detalle del mes...
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center space-x-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <p className="text-xs text-gray-500">Ingresos</p>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(data.totals.revenue)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center space-x-2 mb-1">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <p className="text-xs text-gray-500">Costo</p>
              </div>
              <p className="text-lg font-bold text-red-700">
                {formatCurrency(data.totals.cogs)}
              </p>
            </div>
            <div className={`bg-white rounded-xl border p-4 ${data.totals.margin >= 0 ? 'border-green-200' : 'border-red-200'}`}>
              <div className="flex items-center space-x-2 mb-1">
                <DollarSign className={`w-4 h-4 ${data.totals.margin >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                <p className="text-xs text-gray-500">Margen</p>
              </div>
              <p className={`text-lg font-bold ${data.totals.margin >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatCurrency(data.totals.margin)}
              </p>
              <p className="text-xs text-gray-400">{data.totals.margin_pct.toFixed(1)}%</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Facturas</p>
              <p className="text-lg font-bold text-gray-900">{data.counts.invoices}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Productos Vendidos</p>
              <p className="text-lg font-bold text-gray-900">{data.counts.products_with_sales}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Con Costo</p>
              <p className="text-lg font-bold text-gray-900">
                {data.counts.products_with_cogs}
                <span className="text-xs font-normal text-gray-400 ml-1">
                  / {data.counts.products_with_sales}
                </span>
              </p>
            </div>
          </div>

          {/* Supplier Summary (collapsible) */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
            <button
              type="button"
              onClick={() => setShowSuppliers(!showSuppliers)}
              className="w-full px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
            >
              <h2 className="text-sm font-semibold text-gray-700">
                Resumen por Proveedor ({data.by_supplier.length})
              </h2>
              {showSuppliers ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </button>
            {showSuppliers && (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                      Proveedor
                    </th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">
                      Tipo
                    </th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase">
                      Productos
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                      Ingresos
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                      Costo
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                      Margen
                    </th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase">
                      %
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.by_supplier.map((s) => (
                    <tr
                      key={s.supplier_name}
                      className={`hover:bg-gray-50 cursor-pointer ${supplierFilter === s.supplier_name ? 'bg-amber-50' : ''}`}
                      onClick={() => setSupplierFilter(supplierFilter === s.supplier_name ? 'all' : s.supplier_name)}
                    >
                      <td className="px-4 py-2 font-medium text-gray-900">
                        {s.supplier_name}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {s.is_consignment ? (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">Consig.</span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">Propio</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600">{s.products_count}</td>
                      <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(s.revenue)}</td>
                      <td className="px-4 py-2 text-right text-red-600">{formatCurrency(s.cogs)}</td>
                      <td className={`px-4 py-2 text-right font-medium ${s.margin >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatCurrency(s.margin)}
                      </td>
                      <td className={`px-3 py-2 text-right ${s.margin_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {s.margin_pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-4 py-3 text-gray-900">TOTAL</td>
                    <td />
                    <td className="px-3 py-3 text-right text-gray-600">
                      {data.by_supplier.reduce((s, r) => s + r.products_count, 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(data.totals.revenue)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{formatCurrency(data.totals.cogs)}</td>
                    <td className={`px-4 py-3 text-right ${data.totals.margin >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {formatCurrency(data.totals.margin)}
                    </td>
                    <td className={`px-3 py-3 text-right ${data.totals.margin_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {data.totals.margin_pct.toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* Filter bar */}
          <div className="flex items-center space-x-3 mb-4">
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
            {supplierFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setSupplierFilter('all')}
                className="text-sm text-amber-700 hover:underline"
              >
                Limpiar filtro
              </button>
            )}
            <span className="text-xs text-gray-400 ml-auto">
              {filteredProducts.length} productos
              {supplierFilter !== 'all' ? ` de ${supplierFilter}` : ''}
            </span>
          </div>

          {/* Product Detail Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">
                Detalle por Producto
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                      Codigo
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase max-w-[250px]">
                      Producto
                    </th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">
                      Proveedor
                    </th>
                    <th
                      className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('quantity')}
                    >
                      Cant.{sortIndicator('quantity')}
                    </th>
                    <th
                      className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('revenue')}
                    >
                      Ingreso{sortIndicator('revenue')}
                    </th>
                    <th
                      className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('cogs')}
                    >
                      Costo{sortIndicator('cogs')}
                    </th>
                    <th
                      className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('margin')}
                    >
                      Margen{sortIndicator('margin')}
                    </th>
                    <th
                      className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('margin_pct')}
                    >
                      %{sortIndicator('margin_pct')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-gray-500">
                        No hay datos para este mes
                      </td>
                    </tr>
                  ) : (
                    <>
                      {filteredProducts.map((p) => (
                        <tr key={p.product_code} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-mono text-xs text-gray-500">
                            {p.product_code}
                          </td>
                          <td className="px-4 py-2 text-gray-900 max-w-[250px] truncate" title={p.product_name}>
                            {p.product_name}
                          </td>
                          <td className="px-3 py-2 text-gray-600 text-xs">
                            <span className={`inline-block px-1.5 py-0.5 rounded ${p.is_consignment ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                              {p.supplier_name}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {p.quantity_sold > 0 ? Math.round(p.quantity_sold) : '—'}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-900">
                            {p.revenue > 0 ? formatCurrency(p.revenue) : '—'}
                          </td>
                          <td className="px-4 py-2 text-right text-red-600">
                            {p.cogs > 0 ? formatCurrency(p.cogs) : (
                              <span className="text-gray-300">$0</span>
                            )}
                          </td>
                          <td className={`px-4 py-2 text-right font-medium ${p.margin >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {p.revenue > 0 || p.cogs > 0 ? formatCurrency(p.margin) : '—'}
                          </td>
                          <td className={`px-3 py-2 text-right text-xs ${p.margin_pct >= 30 ? 'text-green-600' : p.margin_pct >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                            {p.revenue > 0 ? `${p.margin_pct.toFixed(1)}%` : '—'}
                          </td>
                        </tr>
                      ))}
                      {/* Totals row */}
                      <tr className="bg-gray-50 font-semibold border-t border-gray-200">
                        <td className="px-4 py-3 text-gray-900" colSpan={3}>
                          TOTAL ({filteredProducts.length} productos)
                        </td>
                        <td className="px-3 py-3 text-right text-gray-900">
                          {Math.round(filteredTotals.quantity_sold)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {formatCurrency(filteredTotals.revenue)}
                        </td>
                        <td className="px-4 py-3 text-right text-red-600">
                          {formatCurrency(filteredTotals.cogs)}
                        </td>
                        <td className={`px-4 py-3 text-right ${filteredTotals.margin >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {formatCurrency(filteredTotals.margin)}
                        </td>
                        <td className={`px-3 py-3 text-right ${filteredTotals.revenue > 0 && filteredTotals.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {pct(filteredTotals.margin, filteredTotals.revenue)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Info note */}
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 mb-4">
            <p className="text-xs text-amber-800">
              <strong>Ingreso:</strong> Subtotal facturado (sin IVA). <strong>Costo:</strong> Cuenta PUC 6135 de comprobantes contables.
              <strong> Margen:</strong> Ingreso - Costo. Productos con costo $0 pueden no tener comprobante contable registrado para este mes.
            </p>
          </div>

          <p className="text-xs text-gray-400">
            {data.counts.invoice_items} items de factura, {data.counts.cogs_items} items de costo analizados.
          </p>
        </>
      ) : null}
    </div>
  );
}

export default function ResumenMesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Cargando...</div>}>
      <MesContent />
    </Suspense>
  );
}
