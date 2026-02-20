'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface SupplierRow {
  supplier_name: string;
  is_consignment: boolean;
  subtotal: number;
  iva: number;
  total: number;
  iva_paid: number;
  iva_pending: number;
  items_count: number;
  quantity: number;
}

interface InvoiceRow {
  id: string;
  name: string;
  date: string;
  customer_name: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  balance: number;
}

interface Summary {
  total_ventas: number;
  total_subtotal: number;
  total_iva: number;
  total_invoices: number;
  total_balance: number;
  total_credit_notes: number;
  credit_notes_count: number;
  consignment_total: number;
  own_total: number;
  neto: number;
}

interface DashboardData {
  month: string;
  available_months: string[];
  summary: Summary;
  by_supplier: SupplierRow[];
  invoices: InvoiceRow[];
  items_analyzed: number;
}

function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-');
  const months = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];
  return `${months[parseInt(m) - 1]} ${y}`;
}

export default function VentasPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [showInvoices, setShowInvoices] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'consignment' | 'own'>(
    'all'
  );

  const loadData = useCallback(async (month?: string) => {
    setLoading(true);
    setError('');
    try {
      const params = month ? `?month=${month}` : '';
      const res = await fetch(`/api/dashboard/ventas${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      if (!month) setSelectedMonth(json.month);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleMonthChange(month: string) {
    setSelectedMonth(month);
    loadData(month);
  }

  const filteredSuppliers = (data?.by_supplier || []).filter((s) => {
    if (typeFilter === 'consignment') return s.is_consignment;
    if (typeFilter === 'own') return !s.is_consignment;
    return true;
  });

  const filteredTotals = filteredSuppliers.reduce(
    (acc, s) => ({
      subtotal: acc.subtotal + s.subtotal,
      iva: acc.iva + s.iva,
      total: acc.total + s.total,
      quantity: acc.quantity + s.quantity,
      items_count: acc.items_count + s.items_count,
    }),
    { subtotal: 0, iva: 0, total: 0, quantity: 0, items_count: 0 }
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <TrendingUp className="w-8 h-8 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ventas</h1>
            <p className="text-gray-500">
              {data ? monthLabel(data.month) : 'Cargando...'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {/* Month selector */}
          <select
            value={selectedMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            disabled={loading}
          >
            {(data?.available_months || []).map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
          <button
            onClick={() => loadData(selectedMonth)}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            />
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
          Cargando datos de ventas...
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Total Ventas</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(data.summary.total_ventas)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Subtotal</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(data.summary.total_subtotal)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">IVA</p>
              <p className="text-lg font-bold text-amber-700">
                {formatCurrency(data.summary.total_iva)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Facturas</p>
              <p className="text-lg font-bold text-gray-900">
                {data.summary.total_invoices}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">
                Notas Credito ({data.summary.credit_notes_count})
              </p>
              <p className="text-lg font-bold text-red-600">
                -{formatCurrency(data.summary.total_credit_notes)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Venta Neta</p>
              <p className="text-lg font-bold text-green-700">
                {formatCurrency(data.summary.neto)}
              </p>
            </div>
          </div>

          {/* Consignment vs Own split */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-purple-50 rounded-xl border border-purple-200 p-4">
              <p className="text-xs text-purple-600 mb-1">Consignacion</p>
              <p className="text-lg font-bold text-purple-900">
                {formatCurrency(data.summary.consignment_total)}
              </p>
              <p className="text-xs text-purple-500">
                {data.summary.total_ventas > 0
                  ? (
                      (data.summary.consignment_total /
                        data.summary.total_ventas) *
                      100
                    ).toFixed(1)
                  : 0}
                % del total
              </p>
            </div>
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
              <p className="text-xs text-blue-600 mb-1">Producto Propio</p>
              <p className="text-lg font-bold text-blue-900">
                {formatCurrency(data.summary.own_total)}
              </p>
              <p className="text-xs text-blue-500">
                {data.summary.total_ventas > 0
                  ? (
                      (data.summary.own_total / data.summary.total_ventas) *
                      100
                    ).toFixed(1)
                  : 0}
                % del total
              </p>
            </div>
            <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
              <p className="text-xs text-orange-600 mb-1">Saldo Pendiente</p>
              <p className="text-lg font-bold text-orange-900">
                {formatCurrency(data.summary.total_balance)}
              </p>
              <p className="text-xs text-orange-500">
                Por cobrar de clientes
              </p>
            </div>
          </div>

          {/* Type filter tabs */}
          <div className="flex space-x-2 mb-4">
            {[
              {
                key: 'all' as const,
                label: 'Todos',
                color: 'amber',
              },
              {
                key: 'consignment' as const,
                label: 'Consignacion',
                color: 'purple',
              },
              {
                key: 'own' as const,
                label: 'Propios',
                color: 'blue',
              },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setTypeFilter(tab.key)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  typeFilter === tab.key
                    ? 'bg-amber-100 text-amber-800 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Supplier Breakdown Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">
                Ventas por Proveedor
              </h2>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    Proveedor
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    Tipo
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    Cant.
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    Subtotal
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    IVA
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    Total
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    %
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center py-8 text-gray-500"
                    >
                      No hay datos para este mes
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredSuppliers.map((s) => (
                      <tr key={`${s.supplier_name}-${s.is_consignment}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {s.supplier_name}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {s.is_consignment ? (
                            <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700">
                              Consignacion
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                              Propio
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">
                          {Math.round(s.quantity)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-900">
                          {formatCurrency(s.subtotal)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-amber-700">
                          {formatCurrency(s.iva)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                          {formatCurrency(s.total)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-500">
                          {filteredTotals.total > 0
                            ? ((s.total / filteredTotals.total) * 100).toFixed(
                                1
                              )
                            : 0}
                          %
                        </td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        TOTAL
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-500">
                        {filteredSuppliers.length} proveedores
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">
                        {Math.round(filteredTotals.quantity)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">
                        {formatCurrency(filteredTotals.subtotal)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-amber-700">
                        {formatCurrency(filteredTotals.iva)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">
                        {formatCurrency(filteredTotals.total)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">
                        100%
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Invoice List (collapsible) */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setShowInvoices(!showInvoices)}
              className="w-full px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-700">
                  Facturas del Mes ({data.invoices.length})
                </h2>
              </div>
              {showInvoices ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </button>
            {showInvoices && (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                      Factura
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                      Fecha
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                      Cliente
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                      Subtotal
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                      IVA
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                      Total
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                      Saldo
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-sm text-gray-900">
                        {inv.name}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {inv.date}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900 max-w-[200px] truncate">
                        {inv.customer_name}
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-gray-900">
                        {formatCurrency(inv.subtotal)}
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-amber-700">
                        {formatCurrency(inv.tax_amount)}
                      </td>
                      <td className="px-4 py-2 text-right text-sm font-medium text-gray-900">
                        {formatCurrency(inv.total)}
                      </td>
                      <td className="px-4 py-2 text-right text-sm">
                        {Number(inv.balance) > 0 ? (
                          <span className="text-orange-600 font-medium">
                            {formatCurrency(inv.balance)}
                          </span>
                        ) : (
                          <span className="text-green-600">Pagada</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer note */}
          <p className="text-xs text-gray-400 mt-4">
            {data.items_analyzed} items de factura analizados para la
            clasificacion por proveedor.
            {data.items_analyzed === 0 &&
              ' Los items de factura no estan disponibles para este mes.'}
          </p>
        </>
      ) : null}
    </div>
  );
}
