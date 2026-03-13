'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, AlertTriangle, CheckCircle, Loader2, Search } from 'lucide-react';
import type { SiigoCustomer, SiigoProduct, SiigoTaxCatalog, SiigoPaymentType } from '@/types/siigo';

const DEFAULT_OBSERVATIONS = 'Atelier Siete\nMuebles & Decoración';

type CatalogsData = {
  customers: SiigoCustomer[];
  products: SiigoProduct[];
  taxes: SiigoTaxCatalog[];
  paymentTypes: SiigoPaymentType[];
};

type InvoiceItem = {
  id: number;
  code: string;
  productSearch: string;
  description: string;
  quantity: number;
  price: number;
  discount: number;
  taxId: number | null;
  taxPercentage: number;
};

let _itemIdCounter = 1;
function newItem(taxId: number | null = null, taxPercentage = 0): InvoiceItem {
  return { id: _itemIdCounter++, code: '', productSearch: '', description: '', quantity: 1, price: 0, discount: 0, taxId, taxPercentage };
}

function getCustomerName(c: SiigoCustomer): string {
  return Array.isArray(c.name) ? c.name.join(' ') : String(c.name);
}

function getCustomerEmail(c: SiigoCustomer): string {
  return c.contacts?.[0]?.email || '';
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export default function CreateInvoiceForm() {
  const [catalogs, setCatalogs] = useState<CatalogsData | null>(null);
  const [catalogsLoading, setCatalogsLoading] = useState(true);
  const [catalogsError, setCatalogsError] = useState<string | null>(null);

  const [selectedCustomer, setSelectedCustomer] = useState<SiigoCustomer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [date, setDate] = useState(todayStr());
  const [dueDate, setDueDate] = useState(todayStr());
  const [items, setItems] = useState<InvoiceItem[]>([newItem()]);
  const [activeProductDropdown, setActiveProductDropdown] = useState<number | null>(null);
  const [paymentTypeId, setPaymentTypeId] = useState<number | null>(null);
  const [observations, setObservations] = useState(DEFAULT_OBSERVATIONS);
  const [sendEmail, setSendEmail] = useState(true);
  const [sendStamp, setSendStamp] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; invoice?: any; error?: string } | null>(null);

  useEffect(() => {
    fetch('/api/siigo/catalogs')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setCatalogs(data);
        if (data.paymentTypes?.length > 0) setPaymentTypeId(data.paymentTypes[0].id);
        const iva19 = (data.taxes as SiigoTaxCatalog[]).find((t) => t.name?.includes('19'));
        if (iva19) setItems([newItem(iva19.id, iva19.percentage)]);
      })
      .catch((e) => setCatalogsError(e.message))
      .finally(() => setCatalogsLoading(false));
  }, []);

  const filteredCustomers = (catalogs?.customers ?? []).filter((c) => {
    if (!customerSearch.trim()) return true;
    const s = customerSearch.toLowerCase();
    return getCustomerName(c).toLowerCase().includes(s) || (c.identification ?? '').toLowerCase().includes(s);
  });

  const filteredProducts = (search: string): SiigoProduct[] => {
    if (!catalogs?.products) return [];
    if (!search.trim()) return catalogs.products.slice(0, 25);
    const s = search.toLowerCase();
    return catalogs.products.filter((p) => p.name?.toLowerCase().includes(s) || p.code?.toLowerCase().includes(s)).slice(0, 25);
  };

  const totals = items.reduce(
    (acc, item) => {
      const sub = item.quantity * item.price * (1 - item.discount / 100);
      const tax = sub * (item.taxPercentage / 100);
      return { subtotal: acc.subtotal + sub, taxTotal: acc.taxTotal + tax };
    },
    { subtotal: 0, taxTotal: 0 }
  );
  const grandTotal = totals.subtotal + totals.taxTotal;

  const updateItem = (id: number, updates: Partial<InvoiceItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...updates } : it)));

  const removeItem = (id: number) => { if (items.length > 1) setItems((prev) => prev.filter((it) => it.id !== id)); };

  const addItem = () => {
    const last = items[items.length - 1];
    setItems((prev) => [...prev, newItem(last?.taxId ?? null, last?.taxPercentage ?? 0)]);
  };

  const selectProduct = (itemId: number, product: SiigoProduct) => {
    const defaultPrice = product.price?.[0]?.price_list?.[0]?.value ?? 0;
    const isExempt = product.tax_classification === 'Exempt' || product.tax_classification === 'Excluded';
    const currentItem = items.find((i) => i.id === itemId);
    updateItem(itemId, {
      code: product.code,
      productSearch: `${product.code} — ${product.name}`,
      description: product.name,
      price: defaultPrice,
      taxId: isExempt ? null : (currentItem?.taxId ?? null),
      taxPercentage: isExempt ? 0 : (currentItem?.taxPercentage ?? 0),
    });
    setActiveProductDropdown(null);
  };

  const handleTaxChange = (itemId: number, rawValue: string) => {
    if (!rawValue) { updateItem(itemId, { taxId: null, taxPercentage: 0 }); return; }
    const taxId = Number(rawValue);
    const tax = catalogs?.taxes.find((t) => t.id === taxId);
    updateItem(itemId, { taxId, taxPercentage: tax?.percentage ?? 0 });
  };

  const canSubmit = Boolean(selectedCustomer) && Boolean(paymentTypeId) && items.every((i) => i.code !== '');

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/siigo/invoices/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerIdentification: selectedCustomer!.identification,
          date, dueDate,
          items: items.map((item) => ({ code: item.code, description: item.description, quantity: item.quantity, price: item.price, discount: item.discount, taxId: item.taxId, taxPercentage: item.taxPercentage })),
          paymentTypeId, observations, sendEmail, sendStamp,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setResult({ success: true, invoice: data.invoice });
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedCustomer(null); setCustomerSearch(''); setDate(todayStr()); setDueDate(todayStr());
    const iva19 = catalogs?.taxes.find((t) => t.name?.includes('19'));
    setItems([newItem(iva19?.id ?? null, iva19?.percentage ?? 0)]);
    setPaymentTypeId(catalogs?.paymentTypes?.[0]?.id ?? null);
    setObservations(DEFAULT_OBSERVATIONS); setSendEmail(true); setSendStamp(false); setResult(null);
  };

  if (catalogsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        <p className="text-gray-600 font-medium">Cargando datos de Siigo...</p>
        <p className="text-sm text-gray-400">Clientes, productos, impuestos y formas de pago</p>
      </div>
    );
  }

  if (catalogsError) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-3">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <p className="text-red-700 font-medium">Error al conectar con Siigo</p>
        <p className="text-sm text-gray-500">{catalogsError}</p>
        <button onClick={() => window.location.reload()} className="mt-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Result banner */}
      {result && (
        <div className={`p-4 rounded-lg flex items-start gap-3 ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          {result.success ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-green-800">¡Factura {result.invoice?.name || ''} creada exitosamente!</p>
                <p className="text-sm text-green-700 mt-0.5">Total: {formatCOP(result.invoice?.total ?? 0)}{sendStamp ? ' · Enviada a la DIAN' : ''}</p>
              </div>
              <button onClick={resetForm} className="text-sm text-green-700 underline whitespace-nowrap">Crear otra</button>
            </>
          ) : (
            <>
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-800">Error al crear la factura</p>
                <p className="text-sm text-red-700 mt-0.5">{result.error}</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Cliente */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Cliente</h2>
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomer(null); }}
              onFocus={() => setShowCustomerDropdown(true)}
              onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
              placeholder="Buscar cliente por nombre o NIT..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
            />
          </div>
          {showCustomerDropdown && filteredCustomers.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {filteredCustomers.slice(0, 40).map((customer) => (
                <button
                  key={customer.id}
                  onMouseDown={() => { setSelectedCustomer(customer); setCustomerSearch(getCustomerName(customer)); setShowCustomerDropdown(false); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-amber-50 border-b border-gray-50 last:border-0"
                >
                  <span className="text-sm font-medium text-gray-800">{getCustomerName(customer)}</span>
                  <span className="text-xs text-gray-400 ml-2">NIT: {customer.identification}</span>
                </button>
              ))}
            </div>
          )}
          {showCustomerDropdown && customerSearch.trim() && filteredCustomers.length === 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
              <p className="text-sm text-gray-400 text-center py-4">Sin resultados para &quot;{customerSearch}&quot;</p>
            </div>
          )}
        </div>
        {selectedCustomer && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            <div><span className="text-gray-500">NIT / CC:</span><span className="ml-1.5 font-medium text-gray-800">{selectedCustomer.identification}</span></div>
            {getCustomerEmail(selectedCustomer) && (
              <div><span className="text-gray-500">Email:</span><span className="ml-1.5 font-medium text-gray-800">{getCustomerEmail(selectedCustomer)}</span></div>
            )}
          </div>
        )}
      </div>

      {/* Fechas */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Fechas</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">Fecha de factura</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">Fecha de vencimiento</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" />
          </div>
        </div>
      </div>

      {/* Ítems */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Ítems</h2>
        <div className="space-y-4">
          {items.map((item, idx) => {
            const itemSubtotal = item.quantity * item.price * (1 - item.discount / 100);
            const itemTax = itemSubtotal * (item.taxPercentage / 100);
            return (
              <div key={item.id} className="border border-gray-100 rounded-lg p-4 bg-gray-50/70">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ítem {idx + 1}</span>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
                {/* Product search */}
                <div className="relative mb-3">
                  <label className="block text-xs text-gray-500 mb-1">Producto / Servicio</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={item.productSearch}
                      onChange={(e) => updateItem(item.id, { productSearch: e.target.value, code: '' })}
                      onFocus={() => setActiveProductDropdown(item.id)}
                      onBlur={() => setTimeout(() => setActiveProductDropdown(null), 150)}
                      placeholder="Buscar por código o nombre..."
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white"
                    />
                  </div>
                  {activeProductDropdown === item.id && (
                    <div className="absolute z-40 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                      {filteredProducts(item.productSearch).map((product) => (
                        <button
                          key={product.id}
                          onMouseDown={() => selectProduct(item.id, product)}
                          className="w-full text-left px-3 py-2.5 hover:bg-amber-50 border-b border-gray-50 last:border-0 flex items-center gap-2"
                        >
                          <span className="text-xs font-mono font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{product.code}</span>
                          <span className="text-sm text-gray-700 flex-1">{product.name}</span>
                          {product.tax_classification === 'Exempt' && <span className="text-xs text-amber-600 font-medium">Exento</span>}
                          {product.tax_classification === 'Excluded' && <span className="text-xs text-gray-400 font-medium">Excluido</span>}
                        </button>
                      ))}
                      {filteredProducts(item.productSearch).length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sin resultados</p>}
                    </div>
                  )}
                </div>
                {/* Description */}
                <div className="mb-3">
                  <label className="block text-xs text-gray-500 mb-1">Descripción</label>
                  <input type="text" value={item.description} onChange={(e) => updateItem(item.id, { description: e.target.value })} placeholder="Descripción..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white" />
                </div>
                {/* Qty · Price · Discount · Tax */}
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
                    <input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Precio (COP)</label>
                    <input type="number" min="0" step="1" value={item.price} onChange={(e) => updateItem(item.id, { price: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Descuento %</label>
                    <input type="number" min="0" max="100" step="0.01" value={item.discount} onChange={(e) => updateItem(item.id, { discount: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Impuesto</label>
                    <select value={item.taxId ?? ''} onChange={(e) => handleTaxChange(item.id, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white">
                      <option value="">Sin IVA</option>
                      {catalogs?.taxes.map((tax) => <option key={tax.id} value={tax.id}>{tax.name} ({tax.percentage}%)</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-2.5 flex justify-end gap-4 text-xs text-gray-500">
                  <span>Subtotal: <span className="font-medium text-gray-700">{formatCOP(itemSubtotal)}</span></span>
                  {item.taxPercentage > 0 && <span>IVA {item.taxPercentage}%: <span className="font-medium text-gray-700">{formatCOP(itemTax)}</span></span>}
                  <span>Total: <span className="font-semibold text-gray-800">{formatCOP(itemSubtotal + itemTax)}</span></span>
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={addItem} className="mt-3 flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-800 font-medium transition-colors">
          <Plus className="w-4 h-4" />Agregar ítem
        </button>
      </div>

      {/* Forma de pago */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Forma de Pago</h2>
        <select value={paymentTypeId ?? ''} onChange={(e) => setPaymentTypeId(Number(e.target.value))} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none">
          <option value="">Seleccionar forma de pago...</option>
          {catalogs?.paymentTypes.map((pt) => <option key={pt.id} value={pt.id}>{pt.name}{pt.due_date ? ` (${pt.due_date} días)` : ''}</option>)}
        </select>
      </div>

      {/* Observaciones */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Observaciones</h2>
        <textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={3} maxLength={4000} placeholder="Observaciones adicionales..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none resize-none" />
        <p className="text-xs text-gray-400 mt-1 text-right">{observations.length} / 4000</p>
      </div>

      {/* Opciones de envío */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Opciones de Envío</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Enviar por correo al cliente</p>
              <p className="text-xs text-gray-400 mt-0.5">{selectedCustomer && getCustomerEmail(selectedCustomer) ? `Se enviará a: ${getCustomerEmail(selectedCustomer)}` : 'Selecciona un cliente para ver su email'}</p>
            </div>
            <button onClick={() => setSendEmail(!sendEmail)} className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${sendEmail ? 'bg-amber-600' : 'bg-gray-200'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${sendEmail ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <div className="border-t border-gray-100" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Enviar a la DIAN</p>
              <p className="text-xs text-gray-500 mt-0.5">{sendStamp ? 'Factura electrónica oficial — no se puede revertir' : 'Desactivado → se guardará como borrador en Siigo'}</p>
            </div>
            <button onClick={() => setSendStamp(!sendStamp)} className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${sendStamp ? 'bg-red-500' : 'bg-gray-200'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${sendStamp ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          {sendStamp && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Advertencia: Factura electrónica oficial</p>
                <p className="text-sm text-red-700 mt-0.5">Esta factura se registrará ante la <strong>DIAN</strong>. Este proceso <strong>no se puede revertir</strong>.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resumen + botón */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Resumen</h2>
        <div className="space-y-2 mb-6">
          <div className="flex justify-between text-sm text-gray-600"><span>Subtotal (sin IVA)</span><span>{formatCOP(totals.subtotal)}</span></div>
          <div className="flex justify-between text-sm text-gray-600"><span>IVA</span><span>{formatCOP(totals.taxTotal)}</span></div>
          <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200">
            <span>Total a Pagar</span>
            <span className="text-amber-700 text-lg">{formatCOP(grandTotal)}</span>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting || !canSubmit}
          className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors flex items-center justify-center gap-2 text-sm ${
            submitting || !canSubmit ? 'bg-gray-300 cursor-not-allowed' : sendStamp ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
          }`}
        >
          {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Creando factura...</> : sendStamp ? 'Crear y enviar a la DIAN' : 'Crear factura (borrador)'}
        </button>
      </div>
    </div>
  );
}
