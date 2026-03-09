'use client';

import { useState, useEffect } from 'react';
import { Package, ChevronDown, ChevronRight, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface ProductInventory {
  code: string;
  name: string;
  supplier: string;
  qty: number;
  sale_price: number;
  sale_value: number;
  cost_unit: number | null;
  cost_value: number | null;
  cost_category: 'real' | 'sospechoso' | 'sin_costo';
  cost_source: string;
  margin_pct: number | null;
  cogs_entries: number;
}

interface SupplierGroup {
  supplier: string;
  products: ProductInventory[];
  total_qty: number;
  total_sale_value: number;
  total_cost_value: number | null;
  products_with_cost: number;
  products_suspicious: number;
  products_no_cost: number;
}

interface MonthMovement {
  month: string;
  month_label: string;
  purchases_value: number;
  purchases_count: number;
  sales_value: number;
  sales_units: number;
  sales_count: number;
}

interface Summary {
  total_products: number;
  total_units: number;
  total_sale_value: number;
  cost_real: { count: number; units: number; cost_value: number; sale_value: number; avg_margin: number; label: string };
  cost_suspicious: { count: number; units: number; cost_value: number; sale_value: number; label: string };
  cost_none: { count: number; units: number; sale_value: number; label: string };
  cost_sources?: { fc_directa: number; cogs_6135: number; sin_costo: number };
  suppliers_count: number;
}

interface InventarioData {
  summary: Summary;
  suppliers: SupplierGroup[];
  monthly_movement: MonthMovement[];
}

function CostBadge({ category }: { category: 'real' | 'sospechoso' | 'sin_costo' }) {
  if (category === 'real') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-green-100 text-green-700">
        <CheckCircle className="w-3 h-3" /> Real
      </span>
    );
  }
  if (category === 'sospechoso') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-orange-100 text-orange-700">
        <AlertTriangle className="w-3 h-3" /> Sospechoso
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-gray-100 text-gray-500">
      <HelpCircle className="w-3 h-3" /> Sin costo
    </span>
  );
}

function MarginBadge({ margin }: { margin: number | null }) {
  if (margin === null) return <span className="text-gray-400">—</span>;
  const color = margin >= 20 ? 'text-green-600' : margin >= 0 ? 'text-amber-600' : 'text-red-600';
  return <span className={`text-xs font-semibold ${color}`}>{margin}%</span>;
}

export default function InventarioPage() {
  const [data, setData] = useState<InventarioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'real' | 'sospechoso' | 'sin_costo'>('all');

  useEffect(() => {
    fetch('/api/dashboard/inventario')
      .then((res) => res.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function toggleSupplier(name: string) {
    setExpandedSuppliers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-500">Cargando inventario...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error || 'Error cargando datos'}
        </div>
      </div>
    );
  }

  const { summary: s, suppliers, monthly_movement } = data;

  // Filter suppliers based on cost category
  const filteredSuppliers = suppliers.map((sup) => {
    if (filter === 'all') return sup;
    const filtered = sup.products.filter((p) => p.cost_category === filter);
    if (filtered.length === 0) return null;
    return {
      ...sup,
      products: filtered,
      total_qty: filtered.reduce((s, p) => s + p.qty, 0),
      total_sale_value: filtered.reduce((s, p) => s + p.sale_value, 0),
    };
  }).filter(Boolean) as SupplierGroup[];

  const totalFiltered = filteredSuppliers.reduce((s, g) => s + g.products.length, 0);

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-6">
        <Package className="w-8 h-8 text-amber-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario Propio</h1>
          <p className="text-gray-500">
            {s.total_products} productos, {s.total_units} unidades en stock
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <p className="text-xs text-amber-600 mb-1">Valor Total (precio venta sin IVA)</p>
          <p className="text-xl font-bold text-amber-900">{formatCurrency(s.total_sale_value)}</p>
          <p className="text-xs text-amber-500 mt-1">{s.total_products} productos, {s.suppliers_count} proveedores</p>
        </div>

        <div className="bg-green-50 rounded-xl border border-green-200 p-4 cursor-pointer hover:bg-green-100/50 transition-colors" onClick={() => setFilter(filter === 'real' ? 'all' : 'real')}>
          <p className="text-xs text-green-600 mb-1 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Costo Real
          </p>
          <p className="text-xl font-bold text-green-900">{formatCurrency(s.cost_real.cost_value)}</p>
          <p className="text-xs text-green-500 mt-1">
            {s.cost_real.count} productos ({s.cost_real.units} uds) — margen prom. {s.cost_real.avg_margin}%
          </p>
        </div>

        <div className="bg-orange-50 rounded-xl border border-orange-200 p-4 cursor-pointer hover:bg-orange-100/50 transition-colors" onClick={() => setFilter(filter === 'sospechoso' ? 'all' : 'sospechoso')}>
          <p className="text-xs text-orange-600 mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Costo Sospechoso
          </p>
          <p className="text-xl font-bold text-orange-900">{formatCurrency(s.cost_suspicious.cost_value)}</p>
          <p className="text-xs text-orange-500 mt-1">
            {s.cost_suspicious.count} productos ({s.cost_suspicious.units} uds) — requiere revisión
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 cursor-pointer hover:bg-gray-100/50 transition-colors" onClick={() => setFilter(filter === 'sin_costo' ? 'all' : 'sin_costo')}>
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
            <HelpCircle className="w-3 h-3" /> Sin Costo
          </p>
          <p className="text-xl font-bold text-gray-700">{formatCurrency(s.cost_none.sale_value)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {s.cost_none.count} productos ({s.cost_none.units} uds) — valor a precio venta
          </p>
        </div>
      </div>

      {/* Cost methodology note */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 mb-6 text-xs text-blue-700">
        <p className="font-semibold mb-1">Metodología de costo</p>
        <p><strong>Costo Real:</strong> Se busca primero en facturas de compra (FC directa) donde el código del producto aparece como cuenta contable (método contadora anterior, pre-Ago 2025). Si no hay FC, se usa el promedio COGS 6135 (costo registrado al vender). Margen razonable (&gt; -20%).</p>
        <p><strong>Costo Sospechoso:</strong> Mismo origen (FC o COGS) pero el margen es menor a -20%. Probablemente el costo es por SET/caja y el precio es por unidad.</p>
        <p><strong>Sin Costo:</strong> No hay factura de compra ni registro COGS para este SKU. No hay dato de costo disponible.</p>
        {s.cost_sources && (
          <p className="mt-1 text-blue-500">
            Fuentes: {s.cost_sources.fc_directa} productos con FC directa, {s.cost_sources.cogs_6135} con COGS 6135, {s.cost_sources.sin_costo} sin costo.
          </p>
        )}
      </div>

      {/* Filter tabs */}
      {filter !== 'all' && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-gray-500">Filtro activo:</span>
          <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-700 font-medium">
            {filter === 'real' ? 'Costo Real' : filter === 'sospechoso' ? 'Sospechoso' : 'Sin Costo'} ({totalFiltered})
          </span>
          <button onClick={() => setFilter('all')} className="text-xs text-blue-600 hover:underline">
            Quitar filtro
          </button>
        </div>
      )}

      {/* Supplier groups */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8">
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700">Inventario por Proveedor</h2>
        </div>

        {filteredSuppliers.map((group) => (
          <div key={group.supplier} className="border-b border-gray-100 last:border-b-0">
            {/* Supplier header row */}
            <div
              className="flex items-center px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => toggleSupplier(group.supplier)}
            >
              <div className="w-5">
                {expandedSuppliers.has(group.supplier)
                  ? <ChevronDown className="w-4 h-4 text-gray-400" />
                  : <ChevronRight className="w-4 h-4 text-gray-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-900">{group.supplier}</span>
                <span className="ml-2 text-xs text-gray-400">
                  {group.products.length} prod. · {group.total_qty} uds
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                {group.products_with_cost > 0 && (
                  <span className="text-green-600 text-xs">{group.products_with_cost} real</span>
                )}
                {group.products_suspicious > 0 && (
                  <span className="text-orange-600 text-xs">{group.products_suspicious} sosp.</span>
                )}
                {group.products_no_cost > 0 && (
                  <span className="text-gray-400 text-xs">{group.products_no_cost} s/costo</span>
                )}
                <span className="font-semibold text-gray-900 w-28 text-right">
                  {formatCurrency(group.total_sale_value)}
                </span>
              </div>
            </div>

            {/* Expanded product detail */}
            {expandedSuppliers.has(group.supplier) && (
              <div className="bg-gray-50/50 border-t border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 uppercase border-b border-gray-200">
                      <th className="text-left px-4 py-2 pl-9">Código</th>
                      <th className="text-left px-2 py-2">Producto</th>
                      <th className="text-center px-2 py-2">Qty</th>
                      <th className="text-right px-2 py-2">Precio Vta</th>
                      <th className="text-right px-2 py-2">Costo/u</th>
                      <th className="text-center px-2 py-2">Margen</th>
                      <th className="text-center px-2 py-2">Estado</th>
                      <th className="text-right px-4 py-2">Valor Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.products.map((p) => (
                      <tr key={p.code} className="border-b border-gray-100 last:border-b-0 hover:bg-white/60">
                        <td className="px-4 py-2 pl-9 font-mono text-gray-600">{p.code}</td>
                        <td className="px-2 py-2 text-gray-900 truncate max-w-[250px]" title={p.name}>{p.name}</td>
                        <td className="px-2 py-2 text-center font-medium">{p.qty}</td>
                        <td className="px-2 py-2 text-right text-gray-700">{formatCurrency(p.sale_price)}</td>
                        <td className="px-2 py-2 text-right">
                          {p.cost_unit !== null ? (
                            <span className={p.cost_category === 'sospechoso' ? 'text-orange-600' : 'text-gray-700'}>
                              {formatCurrency(p.cost_unit)}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <MarginBadge margin={p.margin_pct} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <CostBadge category={p.cost_category} />
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-gray-900">
                          {p.cost_category === 'real' && p.cost_value !== null
                            ? formatCurrency(p.cost_value)
                            : formatCurrency(p.sale_value)
                          }
                          {p.cost_category !== 'real' && (
                            <span className="text-[9px] text-gray-400 ml-1">(vta)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-semibold text-xs">
                      <td colSpan={2} className="px-4 py-2 pl-9 text-gray-600">Subtotal {group.supplier}</td>
                      <td className="px-2 py-2 text-center">{group.total_qty}</td>
                      <td colSpan={4}></td>
                      <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(group.total_sale_value)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Monthly Movement Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8">
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700">Movimiento Mensual — Inventario Propio</h2>
          <p className="text-xs text-gray-400 mt-0.5">Compras: facturas con cuenta 6135/1435 + facturas históricas con código de producto como cuenta. Ventas: facturas de venta por código de producto propio.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase border-b border-gray-200">
                <th className="text-left px-4 py-3">Mes</th>
                <th className="text-right px-4 py-3">
                  <span className="inline-flex items-center gap-1"><TrendingUp className="w-3 h-3 text-green-500" /> Compras</span>
                </th>
                <th className="text-center px-2 py-3"># FC</th>
                <th className="text-right px-4 py-3">
                  <span className="inline-flex items-center gap-1"><TrendingDown className="w-3 h-3 text-red-500" /> Ventas</span>
                </th>
                <th className="text-center px-2 py-3"># Items</th>
                <th className="text-center px-2 py-3">Uds vendidas</th>
                <th className="text-right px-4 py-3">Neto (Compras - Ventas)</th>
              </tr>
            </thead>
            <tbody>
              {monthly_movement.map((m) => {
                const neto = m.purchases_value - m.sales_value;
                return (
                  <tr key={m.month} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">{m.month_label}</td>
                    <td className="px-4 py-2 text-right text-green-700 font-medium">
                      {m.purchases_value > 0 ? formatCurrency(m.purchases_value) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-2 py-2 text-center text-gray-500 text-xs">
                      {m.purchases_count > 0 ? m.purchases_count : ''}
                    </td>
                    <td className="px-4 py-2 text-right text-red-600 font-medium">
                      {m.sales_value > 0 ? formatCurrency(m.sales_value) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-2 py-2 text-center text-gray-500 text-xs">
                      {m.sales_count > 0 ? m.sales_count : ''}
                    </td>
                    <td className="px-2 py-2 text-center text-gray-500 text-xs">
                      {m.sales_units > 0 ? m.sales_units : ''}
                    </td>
                    <td className={`px-4 py-2 text-right font-semibold ${neto >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {formatCurrency(Math.abs(neto))}
                      <span className="text-[10px] ml-1">{neto >= 0 ? '(acum.)' : '(red.)'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold border-t border-gray-200">
                <td className="px-4 py-3 text-gray-700">TOTAL</td>
                <td className="px-4 py-3 text-right text-green-700">
                  {formatCurrency(monthly_movement.reduce((s, m) => s + m.purchases_value, 0))}
                </td>
                <td className="px-2 py-3 text-center text-gray-500 text-xs">
                  {monthly_movement.reduce((s, m) => s + m.purchases_count, 0)}
                </td>
                <td className="px-4 py-3 text-right text-red-600">
                  {formatCurrency(monthly_movement.reduce((s, m) => s + m.sales_value, 0))}
                </td>
                <td className="px-2 py-3 text-center text-gray-500 text-xs">
                  {monthly_movement.reduce((s, m) => s + m.sales_count, 0)}
                </td>
                <td className="px-2 py-3 text-center text-gray-500 text-xs">
                  {monthly_movement.reduce((s, m) => s + m.sales_units, 0)}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {formatCurrency(Math.abs(monthly_movement.reduce((s, m) => s + m.purchases_value - m.sales_value, 0)))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
