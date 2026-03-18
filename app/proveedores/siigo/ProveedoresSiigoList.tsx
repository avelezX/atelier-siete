'use client';
import { useState } from 'react';
import { Package, X, ChevronRight } from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  product_count: number;
}

interface Product {
  id: string;
  name: string;
  code?: string;
  sale_price?: number;
}

interface SiigoDatos {
  identification?: string;
  person_type?: string;
  id_type?: string;
  active?: boolean;
  vat_responsible?: boolean;
  direccion?: string;
  telefonos?: string;
  contactos?: Array<{ nombre: string; email: string }>;
}

interface DatosResult {
  id: string;
  nombre: string;
  siigo: SiigoDatos | null;
}

export default function ProveedoresSiigoList({ suppliers }: { suppliers: Supplier[] }) {
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [tab, setTab] = useState<'productos' | 'datos'>('productos');
  const [products, setProducts] = useState<Product[]>([]);
  const [datos, setDatos] = useState<DatosResult | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingDatos, setLoadingDatos] = useState(false);

  async function handleSelect(s: Supplier) {
    if (selected?.id === s.id) { setSelected(null); return; }
    setSelected(s);
    setTab('productos');
    setProducts([]);
    setDatos(null);

    setLoadingProducts(true);
    fetch(`/api/proveedores/siigo/${s.id}/productos`)
      .then(r => r.ok ? r.json() : [])
      .then(setProducts)
      .finally(() => setLoadingProducts(false));
  }

  async function handleTabDatos() {
    setTab('datos');
    if (datos || loadingDatos || !selected) return;
    setLoadingDatos(true);
    fetch(`/api/proveedores/siigo/${selected.id}/datos`)
      .then(r => r.ok ? r.json() : null)
      .then(setDatos)
      .finally(() => setLoadingDatos(false));
  }

  return (
    <div className="flex gap-5">
      {/* Lista */}
      <div className={`bg-white border border-gray-200 rounded-xl overflow-hidden transition-all ${selected ? 'w-80 shrink-0' : 'w-full'}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</th>
              {!selected && (
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Productos</th>
              )}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {suppliers.map(s => (
              <tr
                key={s.id}
                onClick={() => handleSelect(s)}
                className={`cursor-pointer transition-colors ${
                  selected?.id === s.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-5 py-3.5 font-medium text-gray-900 truncate max-w-0">
                  <span className="block truncate">{s.name}</span>
                </td>
                {!selected && (
                  <td className="px-5 py-3.5 text-right">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${
                      s.product_count > 0 ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {s.product_count}
                    </span>
                  </td>
                )}
                <td className="px-2 py-3.5 text-gray-400">
                  <ChevronRight className={`w-4 h-4 transition-transform ${selected?.id === s.id ? 'rotate-90 text-blue-500' : ''}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Panel detalle */}
      {selected && (
        <div className="flex-1 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">{selected.name}</h3>
              <p className="text-xs text-gray-400 mt-0.5">{selected.product_count} producto{selected.product_count !== 1 ? 's' : ''} en catálogo</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setTab('productos')}
              className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === 'productos' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Productos ({selected.product_count})
            </button>
            <button
              onClick={handleTabDatos}
              className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === 'datos' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Datos
            </button>
          </div>

          {/* Contenido */}
          <div className="overflow-y-auto max-h-[500px]">
            {tab === 'productos' && (
              loadingProducts ? (
                <div className="text-center py-10 text-sm text-gray-400">Cargando productos...</div>
              ) : products.length === 0 ? (
                <div className="text-center py-14">
                  <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Sin productos registrados</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Producto</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Código</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Precio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {products.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">{p.name}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.code || '—'}</td>
                        <td className="px-5 py-3 text-right text-gray-700">
                          {p.sale_price ? `$${p.sale_price.toLocaleString('es-CO')}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {tab === 'datos' && (
              loadingDatos ? (
                <div className="text-center py-10 text-sm text-gray-400">Buscando en Siigo...</div>
              ) : (
                <div className="p-5 space-y-0">
                  <DataRow label="Nombre" value={selected.name} />
                  {datos?.siigo ? (
                    <>
                      <DataRow label="NIT / Identificación" value={datos.siigo.identification} />
                      <DataRow label="Tipo de persona" value={datos.siigo.person_type === 'Company' ? 'Jurídica' : 'Natural'} />
                      <DataRow label="Tipo documento" value={datos.siigo.id_type} />
                      <DataRow label="Dirección" value={datos.siigo.direccion} />
                      <DataRow label="Teléfonos" value={datos.siigo.telefonos} />
                      <DataRow label="Responsable IVA" value={datos.siigo.vat_responsible ? 'Sí' : 'No'} />
                      <DataRow label="Estado en Siigo" value={datos.siigo.active ? 'Activo' : 'Inactivo'} />
                      {datos.siigo.contactos && datos.siigo.contactos.length > 0 && (
                        <div className="py-2.5 border-b border-gray-50">
                          <span className="text-xs text-gray-400 block mb-1.5">Contactos</span>
                          {datos.siigo.contactos.map((c, i) => (
                            <div key={i} className="text-sm text-gray-900">
                              {c.nombre}{c.email ? <span className="text-gray-400 ml-2 text-xs">{c.email}</span> : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-6 text-center text-sm text-gray-400">
                      No se encontró información adicional en Siigo
                    </div>
                  )}
                  <DataRow label="ID interno" value={selected.id} mono />
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DataRow({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-4 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-40 shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm text-gray-900 ${mono ? 'font-mono text-xs' : ''}`}>{value || '—'}</span>
    </div>
  );
}
