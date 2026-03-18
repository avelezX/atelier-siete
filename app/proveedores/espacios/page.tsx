import Link from 'next/link';
import { ArrowLeft, Plus, Package, User, Key } from 'lucide-react';
import { atelierTableAdmin } from '@/lib/supabase';

async function getEspacios() {
  const { data } = await atelierTableAdmin('proveedores')
    .select('id, nit, nombre, tipo, activo, password, created_at')
    .order('nombre');
  return data || [];
}

export default async function EspaciosPage() {
  const espacios = await getEspacios();
  const activos = espacios.filter((e: { activo: boolean }) => e.activo).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/proveedores" className="text-gray-400 hover:text-gray-700 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Espacios de Proveedores</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {activos} activo{activos !== 1 ? 's' : ''} · {espacios.length} total
              </p>
            </div>
          </div>
          <Link
            href="/proveedores/espacios/nuevo"
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo espacio
          </Link>
        </div>
      </div>

      <div className="px-8 py-6">
        {espacios.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Sin espacios creados</p>
            <p className="text-sm text-gray-400 mt-1 mb-4">Crea el primero asignando un proveedor de Siigo</p>
            <Link
              href="/proveedores/espacios/nuevo"
              className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Nuevo espacio
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {espacios.map((e: {
              id: string; nit: string; nombre: string;
              tipo: string; activo: boolean; password: string; created_at: string
            }) => (
              <Link
                key={e.id}
                href={`/proveedores/espacios/${e.id}`}
                className="bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-amber-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                      <Package className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{e.nombre}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <User className="w-3 h-3" /> {e.nit}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Key className="w-3 h-3" /> {e.password}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      e.tipo === 'consignacion' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {e.tipo === 'consignacion' ? 'Consignación' : 'Directo'}
                    </span>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      e.activo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {e.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
