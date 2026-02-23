'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Loader2, CheckCircle, XCircle, RotateCcw, Calendar } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface SelectedProduct {
  product_code: string;
  product_name: string;
  estimated_cost: number;
  quantity_sold: number;
  status: string;
  sale_month?: string;
}

interface DocumentType {
  id: number;
  name: string;
  type: string;
}

interface BatchResult {
  batch: number;
  month?: string;
  product_codes: string[];
  success: boolean;
  journal_name?: string;
  journal_id?: string;
  error?: string;
}

interface Props {
  products: SelectedProduct[];
  defaultDate: string;
  onClose: () => void;
  onSuccess: () => void;
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

function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 0).getDate();
  return `${ym}-${String(d).padStart(2, '0')}`;
}

function productKey(p: SelectedProduct): string {
  return p.sale_month ? `${p.product_code}::${p.sale_month}` : p.product_code;
}

export default function JournalModal({ products, defaultDate, onClose, onSuccess }: Props) {
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [loadingDocTypes, setLoadingDocTypes] = useState(true);
  const [selectedDocType, setSelectedDocType] = useState<number | ''>('');
  const [date, setDate] = useState(defaultDate);
  const [cogsAccount, setCogsAccount] = useState('61350501');
  const [inventoryAccount, setInventoryAccount] = useState('14350101');
  const [customerIdentification, setCustomerIdentification] = useState('901764924');
  const [observations, setObservations] = useState('');
  const [creating, setCreating] = useState(false);
  const [results, setResults] = useState<BatchResult[] | null>(null);
  const [error, setError] = useState('');

  const [costOverrides, setCostOverrides] = useState<Record<string, number>>({});

  // Detect per-month mode
  const hasMonths = products.some(p => p.sale_month);

  // Group by month when in per-month mode
  const monthGroups = useMemo(() => {
    if (!hasMonths) return null;
    const groups = new Map<string, SelectedProduct[]>();
    for (const p of products) {
      const month = p.sale_month || 'unknown';
      if (!groups.has(month)) groups.set(month, []);
      groups.get(month)!.push(p);
    }
    // Sort by month
    return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }, [products, hasMonths]);

  // Initialize cost overrides
  useEffect(() => {
    const initial: Record<string, number> = {};
    products.forEach(p => { initial[productKey(p)] = Math.round(p.estimated_cost); });
    setCostOverrides(initial);
  }, [products]);

  useEffect(() => {
    fetch('/api/siigo/document-types?type=CC')
      .then(r => r.json())
      .then(data => {
        const types: DocumentType[] = data.results || [];
        setDocTypes(types);
        const costeo = types.find(t => t.name.toLowerCase().includes('costeo'));
        if (costeo) setSelectedDocType(costeo.id);
        else if (types.length === 1) setSelectedDocType(types[0].id);
      })
      .catch(e => setError(`Error cargando tipos de documento: ${e.message}`))
      .finally(() => setLoadingDocTypes(false));
  }, []);

  function getCost(key: string, fallback: number): number {
    return costOverrides[key] ?? Math.round(fallback);
  }

  function updateCost(key: string, value: number) {
    setCostOverrides(prev => ({ ...prev, [key]: value }));
  }

  function resetAllCosts() {
    const reset: Record<string, number> = {};
    products.forEach(p => { reset[productKey(p)] = Math.round(p.estimated_cost); });
    setCostOverrides(reset);
  }

  const totalCost = useMemo(
    () => products.reduce((s, p) => s + getCost(productKey(p), p.estimated_cost), 0),
    [products, costOverrides] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const hasOverrides = products.some(p =>
    getCost(productKey(p), p.estimated_cost) !== Math.round(p.estimated_cost)
  );

  // Per-month cost totals (for display)
  const monthTotals = useMemo(() => {
    if (!monthGroups) return null;
    const totals = new Map<string, number>();
    for (const [month, prods] of monthGroups) {
      totals.set(month, prods.reduce((s, p) => s + getCost(productKey(p), p.estimated_cost), 0));
    }
    return totals;
  }, [monthGroups, costOverrides]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    if (!selectedDocType) { setError('Seleccione un tipo de documento'); return; }
    if (!hasMonths && !date) { setError('Seleccione una fecha'); return; }
    if (!cogsAccount || !inventoryAccount) { setError('Ingrese las cuentas contables'); return; }
    if (!customerIdentification) { setError('Ingrese el NIT de la empresa'); return; }

    setCreating(true);
    setError('');
    setResults(null);

    try {
      if (monthGroups) {
        // Per-month: one API call per month
        const allResults: BatchResult[] = [];
        let batchOffset = 0;

        for (const [month, monthProducts] of monthGroups) {
          const monthDate = lastDayOfMonth(month);

          const res = await fetch('/api/siigo/journals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              document_type_id: selectedDocType,
              date: monthDate,
              cogs_account: cogsAccount,
              inventory_account: inventoryAccount,
              customer_identification: customerIdentification,
              products: monthProducts.map(p => ({
                product_code: p.product_code,
                product_name: p.product_name,
                estimated_cost: getCost(productKey(p), p.estimated_cost),
                quantity_sold: p.quantity_sold,
              })),
              observations: observations || `Costeo ${formatMonth(month)}`,
            }),
          });
          const respData = await res.json();
          if (respData.error) throw new Error(`${formatMonth(month)}: ${respData.error}`);

          const monthResults = (respData.results as BatchResult[]).map(r => ({
            ...r,
            batch: r.batch + batchOffset,
            month,
          }));
          allResults.push(...monthResults);
          batchOffset += (respData.results as BatchResult[]).length;
        }

        setResults(allResults);
        if (allResults.every(r => r.success)) {
          setTimeout(() => onSuccess(), 3000);
        }
      } else {
        // Single-date flow (backward compatible)
        const res = await fetch('/api/siigo/journals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document_type_id: selectedDocType,
            date,
            cogs_account: cogsAccount,
            inventory_account: inventoryAccount,
            customer_identification: customerIdentification,
            products: products.map(p => ({
              product_code: p.product_code,
              product_name: p.product_name,
              estimated_cost: getCost(productKey(p), p.estimated_cost),
              quantity_sold: p.quantity_sold,
            })),
            observations,
          }),
        });
        const respData = await res.json();
        if (respData.error) throw new Error(respData.error);
        setResults(respData.results);
        if (respData.fail_count === 0) {
          setTimeout(() => onSuccess(), 3000);
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setCreating(false);
    }
  }

  const numJournals = monthGroups ? monthGroups.size : 1;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Crear Comprobante Contable</h2>
            <p className="text-sm text-gray-500">
              {products.length} producto(s)
              {hasMonths && ` — ${numJournals} comprobante(s), uno por mes de venta`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {results === null ? (
            <>
              {/* Configuration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Documento (CC)
                  </label>
                  {loadingDocTypes ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
                    </div>
                  ) : (
                    <select
                      value={selectedDocType}
                      onChange={e => setSelectedDocType(Number(e.target.value) || '')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    >
                      <option value="">Seleccionar...</option>
                      {docTypes.map(dt => (
                        <option key={dt.id} value={dt.id}>{dt.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {hasMonths ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      Ultimo dia del mes de venta
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                    <input
                      type="date"
                      title="Fecha del comprobante"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cuenta Costo de Ventas (Debito)
                  </label>
                  <input
                    type="text"
                    value={cogsAccount}
                    onChange={e => setCogsAccount(e.target.value)}
                    placeholder="61350501"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cuenta Inventario (Credito)
                  </label>
                  <input
                    type="text"
                    value={inventoryAccount}
                    onChange={e => setInventoryAccount(e.target.value)}
                    placeholder="14350501"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    NIT Empresa (Tercero)
                  </label>
                  <input
                    type="text"
                    value={customerIdentification}
                    onChange={e => setCustomerIdentification(e.target.value)}
                    placeholder="901234567"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Products list */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Productos ({products.length})
                  </h3>
                  {hasOverrides && (
                    <button type="button" onClick={resetAllCosts}
                      className="flex items-center gap-1 text-xs text-amber-700 hover:underline">
                      <RotateCcw className="w-3 h-3" />
                      Restaurar sugeridos
                    </button>
                  )}
                </div>

                {hasMonths && monthGroups && monthTotals ? (
                  /* Per-month grouped table */
                  <div className="border border-gray-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                    {[...monthGroups.entries()].map(([month, prods]) => (
                      <div key={month}>
                        <div className="bg-gray-100 px-3 py-1.5 flex items-center justify-between sticky top-0 border-b border-gray-200">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-gray-500" />
                            <span className="text-xs font-semibold text-gray-700">
                              {formatMonth(month)}
                            </span>
                            <span className="text-xs text-gray-500">
                              — {prods.length} prod. — Fecha: {lastDayOfMonth(month)}
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-gray-700">
                            {formatCurrency(monthTotals.get(month) || 0)}
                          </span>
                        </div>
                        <table className="w-full text-sm">
                          <tbody className="divide-y divide-gray-100">
                            {prods.map(p => {
                              const key = productKey(p);
                              const suggested = Math.round(p.estimated_cost);
                              const current = getCost(key, p.estimated_cost);
                              const isModified = current !== suggested;
                              return (
                                <tr key={key} className={`hover:bg-gray-50 ${isModified ? 'bg-amber-50/30' : ''}`}>
                                  <td className="px-3 py-1.5 font-mono text-xs text-gray-600 w-24">
                                    {p.product_code}
                                  </td>
                                  <td className="px-3 py-1.5 text-gray-900 truncate max-w-[180px]" title={p.product_name}>
                                    {p.product_name}
                                  </td>
                                  <td className="px-3 py-1.5 text-right text-gray-600 w-12">
                                    {p.quantity_sold}
                                  </td>
                                  <td className="px-3 py-1.5 text-right text-gray-400 text-xs w-24">
                                    {formatCurrency(suggested)}
                                  </td>
                                  <td className="px-1 py-1 text-right w-32">
                                    <input
                                      type="number"
                                      title={`Costo para ${p.product_code} ${month}`}
                                      value={current}
                                      onChange={e => updateCost(key, Math.round(Number(e.target.value) || 0))}
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
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Original flat table (backward compatible) */
                  <div className="border border-gray-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">Codigo</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">Producto</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-medium">Cant.</th>
                          <th className="text-right px-3 py-2 text-gray-400 font-medium text-xs">Sugerido</th>
                          <th className="text-right px-3 py-2 text-amber-600 font-medium">Costo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {products.map(p => {
                          const key = productKey(p);
                          const suggested = Math.round(p.estimated_cost);
                          const current = getCost(key, p.estimated_cost);
                          const isModified = current !== suggested;
                          return (
                            <tr key={key} className={`hover:bg-gray-50 ${isModified ? 'bg-amber-50/30' : ''}`}>
                              <td className="px-3 py-1.5 font-mono text-xs text-gray-600">
                                {p.product_code}
                              </td>
                              <td className="px-3 py-1.5 text-gray-900 truncate max-w-[180px]" title={p.product_name}>
                                {p.product_name}
                              </td>
                              <td className="px-3 py-1.5 text-right text-gray-600">
                                {p.quantity_sold}
                              </td>
                              <td className="px-3 py-1.5 text-right text-gray-400 text-xs">
                                {formatCurrency(suggested)}
                              </td>
                              <td className="px-1 py-1 text-right">
                                <input
                                  type="number"
                                  title={`Costo para ${p.product_code}`}
                                  value={current}
                                  onChange={e => updateCost(key, Math.round(Number(e.target.value) || 0))}
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
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="text-xs text-gray-400 mt-1">
                  {hasMonths
                    ? 'Cada mes genera un comprobante separado con fecha = ultimo dia del mes de venta.'
                    : 'Sugerido = Subtotal x 0.70. Puedes editar el costo de cada producto antes de crear el comprobante.'}
                </p>
              </div>

              {/* Summary */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-amber-700 font-medium">Total Debito (6135)</p>
                    <p className="text-lg font-bold text-amber-900">{formatCurrency(totalCost)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-amber-700 font-medium">Total Credito (1435)</p>
                    <p className="text-lg font-bold text-amber-900">{formatCurrency(totalCost)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-amber-700 font-medium">Diferencia</p>
                    <p className="text-lg font-bold text-green-700">$0</p>
                  </div>
                </div>
                <p className="text-xs text-amber-600 text-center mt-2">
                  Debitos = Creditos (cuadrado)
                  {hasOverrides && ' | Costos modificados manualmente'}
                  {hasMonths
                    ? ` | ${numJournals} comprobante(s) por mes`
                    : products.length > 50
                      ? ` | Se crearan ${Math.ceil(products.length / 50)} comprobante(s) en lotes de 50`
                      : ''}
                </p>
              </div>

              {/* Observations */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones (opcional)
                </label>
                <textarea
                  value={observations}
                  onChange={e => setObservations(e.target.value)}
                  rows={2}
                  placeholder={hasMonths ? 'Se auto-generara "Costeo [Mes Ano]" si se deja vacio' : 'Ajuste costo de venta estimado (70%)...'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  maxLength={4000}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </>
          ) : (
            /* Results */
            <div className="space-y-4">
              <div className="text-center py-4">
                {results.every(r => r.success) ? (
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                ) : (
                  <XCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
                )}
                <h3 className="text-lg font-bold text-gray-900">
                  {results.filter(r => r.success).length} de {results.length} lote(s) creado(s)
                </h3>
              </div>

              <div className="space-y-2">
                {results.map(r => (
                  <div
                    key={`${r.batch}-${r.month || ''}`}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
                      r.success
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-medium ${r.success ? 'text-green-800' : 'text-red-800'}`}>
                        {r.month ? formatMonth(r.month) : `Lote ${r.batch}`}
                        {' '}&mdash; {r.product_codes.length} producto(s)
                        {r.month && ` — Fecha: ${lastDayOfMonth(r.month)}`}
                      </p>
                      {r.success && r.journal_name && (
                        <p className="text-xs text-green-600">Comprobante: {r.journal_name}</p>
                      )}
                      {r.error && (
                        <p className="text-xs text-red-600 mt-1">{r.error}</p>
                      )}
                    </div>
                    {r.success ? (
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>

              {results.every(r => r.success) && (
                <p className="text-sm text-center text-gray-500">
                  Cerrando automaticamente...
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          {results === null ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={creating}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !selectedDocType || (!hasMonths && !date) || !customerIdentification}
                className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creando...
                  </>
                ) : hasMonths ? (
                  `Crear ${numJournals} Comprobante(s)`
                ) : (
                  `Crear Comprobante (${products.length} productos)`
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={results.every(r => r.success) ? onSuccess : onClose}
              className="px-6 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
