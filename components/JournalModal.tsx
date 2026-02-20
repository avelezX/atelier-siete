'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Loader2, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface SelectedProduct {
  product_code: string;
  product_name: string;
  estimated_cost: number;
  quantity_sold: number;
  status: string;
}

interface DocumentType {
  id: number;
  name: string;
  type: string;
}

interface BatchResult {
  batch: number;
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

  // Editable costs: key = product_code, value = user-adjusted cost
  const [costOverrides, setCostOverrides] = useState<Record<string, number>>({});

  // Initialize with estimated costs
  useEffect(() => {
    const initial: Record<string, number> = {};
    products.forEach(p => { initial[p.product_code] = Math.round(p.estimated_cost); });
    setCostOverrides(initial);
  }, [products]);

  useEffect(() => {
    fetch('/api/siigo/document-types?type=CC')
      .then(r => r.json())
      .then(data => {
        const types: DocumentType[] = data.results || [];
        setDocTypes(types);
        // Auto-select "Costeo" if available, otherwise first type
        const costeo = types.find(t => t.name.toLowerCase().includes('costeo'));
        if (costeo) setSelectedDocType(costeo.id);
        else if (types.length === 1) setSelectedDocType(types[0].id);
      })
      .catch(e => setError(`Error cargando tipos de documento: ${e.message}`))
      .finally(() => setLoadingDocTypes(false));
  }, []);

  function getCost(code: string, fallback: number): number {
    return costOverrides[code] ?? Math.round(fallback);
  }

  function updateCost(code: string, value: number) {
    setCostOverrides(prev => ({ ...prev, [code]: value }));
  }

  function resetAllCosts() {
    const reset: Record<string, number> = {};
    products.forEach(p => { reset[p.product_code] = Math.round(p.estimated_cost); });
    setCostOverrides(reset);
  }

  const totalCost = useMemo(
    () => products.reduce((s, p) => s + getCost(p.product_code, p.estimated_cost), 0),
    [products, costOverrides] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const hasOverrides = products.some(p => getCost(p.product_code, p.estimated_cost) !== Math.round(p.estimated_cost));

  async function handleCreate() {
    if (!selectedDocType) { setError('Seleccione un tipo de documento'); return; }
    if (!date) { setError('Seleccione una fecha'); return; }
    if (!cogsAccount || !inventoryAccount) { setError('Ingrese las cuentas contables'); return; }
    if (!customerIdentification) { setError('Ingrese el NIT de la empresa'); return; }

    setCreating(true);
    setError('');
    setResults(null);

    try {
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
            estimated_cost: getCost(p.product_code, p.estimated_cost),
            quantity_sold: p.quantity_sold,
          })),
          observations,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data.results);
      if (data.fail_count === 0) {
        setTimeout(() => onSuccess(), 3000);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Crear Comprobante Contable</h2>
            <p className="text-sm text-gray-500">
              {products.length} producto(s) seleccionado(s)
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>

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
                      Restaurar sugeridos (70%)
                    </button>
                  )}
                </div>
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
                        const suggested = Math.round(p.estimated_cost);
                        const current = getCost(p.product_code, p.estimated_cost);
                        const isModified = current !== suggested;
                        return (
                          <tr key={p.product_code} className={`hover:bg-gray-50 ${isModified ? 'bg-amber-50/30' : ''}`}>
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
                                onChange={e => updateCost(p.product_code, Math.round(Number(e.target.value) || 0))}
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
                <p className="text-xs text-gray-400 mt-1">
                  Sugerido = Subtotal x 0.70. Puedes editar el costo de cada producto antes de crear el comprobante.
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
                  {products.length > 50 && ` | Se crearan ${Math.ceil(products.length / 50)} comprobante(s) en lotes de 50`}
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
                  placeholder="Ajuste costo de venta estimado (70%)..."
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
                    key={r.batch}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
                      r.success
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-medium ${r.success ? 'text-green-800' : 'text-red-800'}`}>
                        Lote {r.batch} — {r.product_codes.length} producto(s)
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
                disabled={creating || !selectedDocType || !date || !customerIdentification}
                className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creando...
                  </>
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
