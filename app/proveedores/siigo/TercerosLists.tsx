'use client';
import { useState } from 'react';
import { X, ChevronRight, Package, Search } from 'lucide-react';

interface Tercero {
  id: string;
  name: string;
  identification: string;
  type: string;
  active: boolean;
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

export default function TercerosLists({ proveedores, clientes }: { proveedores: Tercero[]; clientes: Tercero[] }) {
  const [activeTab, setActiveTab] = useState<'proveedores' | 'clientes'>('proveedores');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Tercero | null>(null);
  const [detailTab, setDetailTab] = useState<'datos'>('datos');
  const [products, setProducts] = useState<Product[]>([]);
  const [datos, setDatos] = useState<DatosResult | null>(null);
  const [loadingDatos, setLoadingDatos] = useState(false);

  const listaBase = activeTab === 'proveedores' ? proveedores : clientes;
  const lista = search.trim()
    ? listaBase.filter(t => t.name.toLowerCase().includes(search.toLowerCase().trim()))
    : listaBase;

  function handleSelect(t: Tercero) {
    if (selected?.id === t.id) { setSelected(null); return; }
    setSelected(t);
    setDetailTab('datos');
    setDatos(null);
    setProducts([]);
    setLoadingDatos(true);
    fetch(`/api/proveedores/siigo/${t.id}/datos`)
      .then(r => r.ok ? r.json() : null)
      .then(setDatos)
      .finally(() => setLoadingDatos(false));
  }

  function switchTab(tab: 'proveedores' | 'clientes') {
    setActiveTab(tab);
    setSelected(null);
    setDatos(null);
    setProducts([]);
    setSearch('');
  }

  return (
    <div>
      {/* Tabs principales */}
      <div className="flex gap-3 mb-4 items-center">
        <button
          onClick={() => switchTab('proveedores')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'proveedores' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Proveedores ({proveedores.length})
        </button>
        <button
          onClick={() => switchTab('clientes')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'clientes' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Clientes ({clientes.length})
        </button>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex gap-5">
        {/* Lista */}
        <div className={`bg-white border border-gray-200 rounded-xl overflow-hidden transition-all ${selected ? 'w-80 shrink-0' : 'w-full'}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</th>
                {!selected && <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">NIT / ID</th>}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lista.map(t => (
                <tr
                  key={t.id}
                  onClick={() => handleSelect(t)}
                  className={`cursor-pointer transition-colors ${
                    selected?.id === t.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50'
                  } ${!t.active ? 'opacity-50' : ''}`}
                >
                  <td className="px-5 py-3.5 font-medium text-gray-900 truncate max-w-0">
                    <span className="block truncate">{t.name}</span>
                  </td>
                  {!selected && (
                    <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">{t.identification}</td>
                  )}
                  <td className="px-2 py-3.5 text-gray-400">
                    <ChevronRight className={`w-4 h-4 transition-transform ${selected?.id === t.id ? 'rotate-90 text-blue-500' : ''}`} />
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
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{selected.identification}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[500px]">
              {loadingDatos ? (
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
                  <DataRow label="ID Siigo" value={selected.id} mono />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
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
