'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, CheckCircle2, AlertCircle, ShoppingCart } from 'lucide-react';

interface DocumentType { id: number; name: string; type: string; }
interface Tax { id: number; name: string; percentage: number; }
interface PaymentType { id: number; name: string; }

interface Item {
  itemType: 'Account' | 'Product' | 'FixedAsset';
  code: string;
  description: string;
  quantity: number;
  price: number;
  discount: number;
  taxId: number | null;
  taxPercentage: number;
}

// Cuentas PUC comunes para gastos de Atelier Siete
const COMMON_ACCOUNTS = [
  { code: '51201001', label: 'Arrendamientos' },
  { code: '51351001', label: 'Servicios públicos - Acueducto (Agua)' },
  { code: '51353001', label: 'Servicios públicos - Energía' },
  { code: '51352001', label: 'Servicios públicos - Gas / Software' },
  { code: '51353501', label: 'Telecomunicaciones - Internet' },
  { code: '51353502', label: 'Telecomunicaciones - Celular' },
  { code: '51303001', label: 'Seguros' },
  { code: '51451001', label: 'Mantenimiento y reparaciones' },
  { code: '51551001', label: 'Fletes y transportes' },
  { code: '51851001', label: 'Publicidad y propaganda' },
  { code: '51952501', label: 'Útiles y papelería' },
  { code: '51102501', label: 'Honorarios profesionales' },
  { code: '53050501', label: 'Gastos bancarios' },
  { code: '51959501', label: 'Otros gastos' },
];

const today = () => new Date().toISOString().split('T')[0];

function emptyItem(): Item {
  return {
    itemType: 'Account',
    code: '',
    description: '',
    quantity: 1,
    price: 0,
    discount: 0,
    taxId: null,
    taxPercentage: 0,
  };
}

export default function CreatePurchaseForm() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>([]);

  // Form fields
  const [documentTypeId, setDocumentTypeId] = useState<number | ''>('');
  const [date, setDate] = useState(today());
  const [dueDate, setDueDate] = useState('');
  const [supplierNit, setSupplierNit] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [providerPrefix, setProviderPrefix] = useState('');
  const [providerNumber, setProviderNumber] = useState('');
  const [paymentTypeId, setPaymentTypeId] = useState<number | ''>('');
  const [observations, setObservations] = useState('');
  const [autoCreateSupplier, setAutoCreateSupplier] = useState(true);
  const [items, setItems] = useState<Item[]>([emptyItem()]);

  useEffect(() => {
    fetch('/api/siigo/purchases/catalogs')
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setDocumentTypes(data.documentTypes || []);
        setTaxes(data.taxes || []);
        setPaymentTypes(data.paymentTypes || []);
        if (data.documentTypes?.length > 0) setDocumentTypeId(data.documentTypes[0].id);
        if (data.paymentTypes?.length > 0) setPaymentTypeId(data.paymentTypes[0].id);
      })
      .catch(e => setCatalogError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const updateItem = (index: number, field: keyof Item, value: any) => {
    setItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === 'taxId') {
        const tax = taxes.find(t => t.id === Number(value));
        next[index].taxPercentage = tax?.percentage ?? 0;
      }
      if (field === 'code' && next[index].itemType === 'Account') {
        const acct = COMMON_ACCOUNTS.find(a => a.code === value);
        if (acct && !next[index].description) {
          next[index].description = acct.label;
        }
      }
      return next;
    });
  };

  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (index: number) => setItems(prev => prev.filter((_, i) => i !== index));

  const getSubtotal = (item: Item) =>
    Math.round(item.quantity * item.price * (1 - item.discount / 100));
  const getItemTotal = (item: Item) => {
    const sub = getSubtotal(item);
    return sub + Math.round(sub * item.taxPercentage / 100);
  };
  const grandTotal = items.reduce((sum, item) => sum + getItemTotal(item), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess('');

    if (!supplierNit.trim()) return setSubmitError('Ingresa el NIT del proveedor');
    if (items.some(i => !i.code.trim())) return setSubmitError('Todos los ítems deben tener un código de cuenta');

    setSubmitting(true);
    try {
      const res = await fetch('/api/siigo/purchases/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentTypeId: Number(documentTypeId),
          date,
          dueDate: dueDate || undefined,
          supplierIdentification: supplierNit.trim(),
          supplierName: supplierName.trim() || undefined,
          providerPrefix: providerPrefix.trim() || undefined,
          providerNumber: providerNumber.trim() || undefined,
          paymentTypeId: Number(paymentTypeId),
          observations: observations.trim() || undefined,
          autoCreateSupplier,
          items,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear la compra');

      const purchase = data.purchase;
      setSubmitSuccess(
        `Factura de compra creada: ${purchase.name || purchase.id}${data.supplierCreated ? ' (proveedor creado automáticamente)' : ''}`
      );
      // Reset form
      setItems([emptyItem()]);
      setSupplierNit('');
      setSupplierName('');
      setProviderPrefix('');
      setProviderNumber('');
      setObservations('');
      setDate(today());
      setDueDate('');
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        <span className="ml-3 text-gray-600">Cargando catálogos...</span>
      </div>
    );
  }

  if (catalogError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700 text-sm">
        <AlertCircle className="w-5 h-5 inline mr-2" />
        {catalogError}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* Success banner */}
      {submitSuccess && (
        <div className="flex items-start space-x-3 bg-green-50 border border-green-200 text-green-800 rounded-xl px-5 py-4 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{submitSuccess}</p>
        </div>
      )}

      {/* Error banner */}
      {submitError && (
        <div className="flex items-start space-x-3 bg-red-50 border border-red-200 text-red-800 rounded-xl px-5 py-4 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{submitError}</p>
        </div>
      )}

      {/* Sección: Encabezado */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Datos de la factura</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de documento</label>
            <select
              value={documentTypeId}
              onChange={e => setDocumentTypeId(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            >
              {documentTypes.map(dt => (
                <option key={dt.id} value={dt.id}>{dt.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Fecha factura</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Fecha vencimiento</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Forma de pago</label>
            <select
              value={paymentTypeId}
              onChange={e => setPaymentTypeId(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            >
              {paymentTypes.map(pt => (
                <option key={pt.id} value={pt.id}>{pt.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Observaciones</label>
            <input
              type="text"
              value={observations}
              onChange={e => setObservations(e.target.value)}
              placeholder="Ej: Factura agua enero 2026"
              maxLength={255}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Sección: Proveedor */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Proveedor</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">NIT / Identificación <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={supplierNit}
              onChange={e => setSupplierNit(e.target.value)}
              placeholder="Ej: 800123456"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre del proveedor</label>
            <input
              type="text"
              value={supplierName}
              onChange={e => setSupplierName(e.target.value)}
              placeholder="Ej: Aguas de Manizales SA"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Prefijo factura proveedor</label>
            <input
              type="text"
              value={providerPrefix}
              onChange={e => setProviderPrefix(e.target.value)}
              placeholder="Ej: FV"
              maxLength={6}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Número factura proveedor</label>
            <input
              type="text"
              value={providerNumber}
              onChange={e => setProviderNumber(e.target.value)}
              placeholder="Ej: 12345"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <label className="flex items-center space-x-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={autoCreateSupplier}
            onChange={e => setAutoCreateSupplier(e.target.checked)}
            className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
          />
          <span>Crear proveedor automáticamente si no existe en Siigo</span>
        </label>
      </div>

      {/* Sección: Ítems */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Ítems / Gastos</h2>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center space-x-1 text-xs font-medium text-amber-600 hover:text-amber-700"
          >
            <Plus className="w-4 h-4" /><span>Agregar ítem</span>
          </button>
        </div>

        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className="border border-gray-100 rounded-lg p-4 space-y-3 bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Ítem {index + 1}</span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="text-gray-300 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                  <select
                    value={item.itemType}
                    onChange={e => updateItem(index, 'itemType', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Account">Cuenta contable</option>
                    <option value="Product">Producto</option>
                    <option value="FixedAsset">Activo fijo</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {item.itemType === 'Account' ? 'Cuenta PUC' : 'Código producto'}
                  </label>
                  {item.itemType === 'Account' ? (
                    <select
                      value={item.code}
                      onChange={e => updateItem(index, 'code', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">Seleccionar cuenta...</option>
                      {COMMON_ACCOUNTS.map(a => (
                        <option key={a.code} value={a.code}>{a.code} — {a.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={item.code}
                      onChange={e => updateItem(index, 'code', e.target.value)}
                      placeholder="Código del producto en Siigo"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                <input
                  type="text"
                  value={item.description}
                  onChange={e => updateItem(index, 'description', e.target.value)}
                  placeholder="Descripción del gasto"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={item.quantity}
                    onChange={e => updateItem(index, 'quantity', Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Precio unitario</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={item.price}
                    onChange={e => updateItem(index, 'price', Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">IVA</label>
                  <select
                    value={item.taxId ?? ''}
                    onChange={e => updateItem(index, 'taxId', e.target.value ? Number(e.target.value) : null)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Sin IVA</option>
                    {taxes.filter(t => t.type === 'IVA' || !t.type).map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.percentage}%)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Total ítem</label>
                  <div className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 font-medium">
                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(getItemTotal(item))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="flex justify-end border-t border-gray-100 pt-4">
          <div className="text-right">
            <p className="text-xs text-gray-500">Total factura</p>
            <p className="text-2xl font-bold text-gray-900">
              {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(grandTotal)}
            </p>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || !documentTypeId || !paymentTypeId}
          className="flex items-center space-x-2 px-6 py-3 bg-amber-600 text-white font-medium text-sm rounded-xl hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Creando en Siigo...</span></>
            : <><ShoppingCart className="w-4 h-4" /><span>Crear Factura de Compra</span></>}
        </button>
      </div>
    </form>
  );
}
