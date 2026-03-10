'use client';

import { useState, useEffect } from 'react';
import { Package, ChevronDown, ChevronRight, ShoppingBag, Handshake, BarChart3 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface ProductBalance {
  code: string;
  name: string;
  supplier: string;
  group: string;
  is_consignment: boolean;
  qty: number;
  sale_price: number;
  sale_value: number;
  cost_unit: number | null;
  cost_value: number | null;
  avg_purchase_cost: number | null;
}

interface SupplierGroup {
  supplier: string;
  products: number;
  total_units: number;
  total_sale_value: number;
  total_cost_value: number;
  items: ProductBalance[];
}

interface CategorySummary {
  products: number;
  total_units: number;
  total_sale_value: number;
  total_cost_value: number;
  products_with_cost: number;
  products_without_cost: number;
}

interface MonthBalance {
  month: string;
  month_label: string;
  own_units: number;
  own_products: number;
  own_cost_value: number;
  own_sale_value: number;
  cons_units: number;
  cons_products: number;
  cons_sale_value: number;
}

interface SaldosData {
  summary: {
    own: CategorySummary;
    consignment: CategorySummary;
    total: CategorySummary;
  };
  own_by_supplier: SupplierGroup[];
  consignment_by_supplier: SupplierGroup[];
  monthly_balance: MonthBalance[];
}

function SummaryCard({ title, icon: Icon, data, color }: {
  title: string;
  icon: React.ElementType;
  data: CategorySummary;
  color: string;
}) {
  return (
    <div className={`bg-white rounded-xl border p-6 ${color}`}>
      <div className="flex items-center gap-3 mb-4">
        <Icon className="w-6 h-6" />
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-500">Productos</p>
          <p className="text-2xl font-bold">{data.products}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Unidades</p>
          <p className="text-2xl font-bold">{data.total_units.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Valor Venta</p>
          <p className="text-xl font-semibold">{formatCurrency(data.total_sale_value)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Costo Promedio</p>
          <p className="text-xl font-semibold">
            {data.total_cost_value > 0 ? formatCurrency(data.total_cost_value) : '—'}
          </p>
        </div>
      </div>
      <div className="mt-3 text-xs text-gray-400">
        {data.products_with_cost} con costo · {data.products_without_cost} sin costo
      </div>
    </div>
  );
}

function SupplierSection({ title, groups }: { title: string; groups: SupplierGroup[] }) {
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-xl border">
      <div className="px-6 py-4 border-b">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">{groups.length} proveedores</p>
      </div>
      <div className="divide-y">
        {groups.map((g) => (
          <div key={g.supplier}>
            <button
              onClick={() => setExpandedSupplier(expandedSupplier === g.supplier ? null : g.supplier)}
              className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {expandedSupplier === g.supplier ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                <span className="font-medium text-gray-900">{g.supplier}</span>
                <span className="text-sm text-gray-500">
                  {g.products} prod · {g.total_units} uds
                </span>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <span className="text-gray-500">
                  Venta: <span className="font-medium text-gray-900">{formatCurrency(g.total_sale_value)}</span>
                </span>
                {g.total_cost_value > 0 && (
                  <span className="text-gray-500">
                    Costo: <span className="font-medium text-gray-900">{formatCurrency(g.total_cost_value)}</span>
                  </span>
                )}
              </div>
            </button>
            {expandedSupplier === g.supplier && (
              <div className="px-6 pb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-2 font-medium">Código</th>
                      <th className="py-2 font-medium">Producto</th>
                      <th className="py-2 font-medium text-right">Cant</th>
                      <th className="py-2 font-medium text-right">Precio Venta</th>
                      <th className="py-2 font-medium text-right">Valor Venta</th>
                      <th className="py-2 font-medium text-right">Costo Prom.</th>
                      <th className="py-2 font-medium text-right">Valor Costo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {g.items.map((item) => (
                      <tr key={item.code} className="hover:bg-gray-50">
                        <td className="py-2 text-gray-500 font-mono text-xs">{item.code}</td>
                        <td className="py-2 text-gray-900 max-w-xs truncate">{item.name}</td>
                        <td className="py-2 text-right">{item.qty}</td>
                        <td className="py-2 text-right">{formatCurrency(item.sale_price)}</td>
                        <td className="py-2 text-right font-medium">{formatCurrency(item.sale_value)}</td>
                        <td className="py-2 text-right">
                          {item.avg_purchase_cost ? formatCurrency(item.avg_purchase_cost) : '—'}
                        </td>
                        <td className="py-2 text-right font-medium">
                          {item.avg_purchase_cost ? formatCurrency(item.avg_purchase_cost * item.qty) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SaldosPage() {
  const [data, setData] = useState<SaldosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'own' | 'consignment'>('own');

  useEffect(() => {
    fetch('/api/dashboard/saldos')
      .then((res) => {
        if (!res.ok) throw new Error('Error cargando saldos');
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto" />
          <p className="mt-4 text-gray-500">Cargando saldos de inventario...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error || 'Error desconocido'}</div>
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Package className="w-7 h-7 text-amber-600" />
          Saldos de Inventario
        </h1>
        <p className="text-gray-500 mt-1">
          Stock actual por producto — clasificado por grupo de inventario de Siigo
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <SummaryCard
          title="Inventario Propio"
          icon={ShoppingBag}
          data={summary.own}
          color="border-amber-200"
        />
        <SummaryCard
          title="Consignación"
          icon={Handshake}
          data={summary.consignment}
          color="border-blue-200"
        />
        <SummaryCard
          title="Total"
          icon={Package}
          data={summary.total}
          color="border-gray-200"
        />
      </div>

      {/* Chart: Own inventory cost by month */}
      {data.monthly_balance && data.monthly_balance.length > 0 && (() => {
        const balances = data.monthly_balance;
        const maxCost = Math.max(...balances.map((mb) => mb.own_cost_value), 1);
        const CHART_HEIGHT = 200;
        return (
          <div className="bg-white rounded-xl border mb-8 p-6">
            <div className="flex items-center gap-3 mb-4">
              <BarChart3 className="w-5 h-5 text-amber-600" />
              <h3 className="text-lg font-semibold text-gray-900">Costo Inventario Propio — Fin de Mes</h3>
            </div>
            {/* Y-axis labels + bars */}
            <div className="flex">
              <div className="flex flex-col justify-between text-xs text-gray-400 pr-2 w-20 shrink-0" style={{ height: CHART_HEIGHT }}>
                <span>{formatCurrency(maxCost)}</span>
                <span>{formatCurrency(Math.round(maxCost / 2))}</span>
                <span>$0</span>
              </div>
              <div className="flex-1 relative border-l border-b border-gray-200" style={{ height: CHART_HEIGHT }}>
                {/* Grid lines */}
                <div className="absolute w-full border-t border-dashed border-gray-100" style={{ top: '50%' }} />
                {/* Bars */}
                <div className="flex items-end gap-[2px] h-full px-1">
                  {balances.map((mb) => {
                    const barHeight = Math.max((mb.own_cost_value / maxCost) * CHART_HEIGHT, 2);
                    return (
                      <div key={mb.month} className="flex-1 group relative flex items-end">
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                          <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-lg">
                            <span className="font-medium">{mb.month_label}</span>
                            <br />Costo: {formatCurrency(mb.own_cost_value)}
                            <br />{mb.own_units.toLocaleString()} uds · {mb.own_products} prod
                          </div>
                        </div>
                        <div
                          className="w-full bg-amber-400 hover:bg-amber-500 rounded-t-sm transition-colors cursor-pointer"
                          style={{ height: barHeight }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {/* X-axis labels */}
            <div className="flex ml-20 px-1 gap-[2px] mt-1">
              {balances.map((mb, i) => (
                <div key={mb.month} className="flex-1 text-center">
                  {i % 3 === 0 ? (
                    <span className="text-[9px] text-gray-500">{mb.month_label.replace(' 20', "'")}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Monthly balance table */}
      {data.monthly_balance && data.monthly_balance.length > 0 && (
        <div className="bg-white rounded-xl border mb-8 overflow-x-auto">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Saldo a Fin de Mes</h3>
            <p className="text-sm text-gray-500">
              Stock reconstruido a fin de mes. Costo = costo promedio de compra × unidades. Valor Vta = precio venta sin IVA × unidades.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b bg-gray-50">
                <th className="px-4 py-3 font-medium text-gray-600">Mes</th>
                <th className="px-4 py-3 font-medium text-amber-700 text-right">Propios Uds</th>
                <th className="px-4 py-3 font-medium text-amber-700 text-right">Propios # Prod</th>
                <th className="px-4 py-3 font-medium text-amber-700 text-right">Costo Inv. Propio</th>
                <th className="px-4 py-3 font-medium text-amber-700 text-right">Valor Vta. Propio</th>
                <th className="px-4 py-3 font-medium text-blue-700 text-right">Consig. Uds</th>
                <th className="px-4 py-3 font-medium text-blue-700 text-right">Consig. # Prod</th>
                <th className="px-4 py-3 font-medium text-blue-700 text-right">Valor Vta. Consig.</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.monthly_balance.map((mb) => (
                <tr key={mb.month} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{mb.month_label}</td>
                  <td className="px-4 py-2 text-right">{mb.own_units.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{mb.own_products}</td>
                  <td className="px-4 py-2 text-right font-medium text-amber-700">
                    {mb.own_cost_value > 0 ? formatCurrency(mb.own_cost_value) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-amber-600">
                    {formatCurrency(mb.own_sale_value)}
                  </td>
                  <td className="px-4 py-2 text-right">{mb.cons_units.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{mb.cons_products}</td>
                  <td className="px-4 py-2 text-right text-blue-600">
                    {formatCurrency(mb.cons_sale_value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('own')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'own'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Propios ({summary.own.products})
        </button>
        <button
          onClick={() => setTab('consignment')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'consignment'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Consignación ({summary.consignment.products})
        </button>
      </div>

      {/* Supplier groups */}
      {tab === 'own' ? (
        <SupplierSection title="Inventario Propio por Proveedor" groups={data.own_by_supplier} />
      ) : (
        <SupplierSection title="Consignación por Proveedor" groups={data.consignment_by_supplier} />
      )}
    </div>
  );
}
