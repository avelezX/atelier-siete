import Link from 'next/link';
import { ArrowLeft, Package, User, Key, Tag } from 'lucide-react';
import { atelierTableAdmin } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import EditProveedorForm from './EditProveedorForm';

interface Producto {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
}

async function getData(id: string) {
  const [provRes, prodRes] = await Promise.all([
    atelierTableAdmin('proveedores')
      .select('id, nit, nombre, tipo, activo, password, created_at')
      .eq('id', id)
      .single(),
    atelierTableAdmin('proveedor_productos')
      .select('id, nombre, descripcion, activo, created_at')
      .eq('proveedor_id', id)
      .order('created_at', { ascending: false }),
  ]);
  if (provRes.error) return null;
  return { proveedor: provRes.data, productos: prodRes.data || [] };
}

export default async function ProveedorDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getData(id);
  if (!result) notFound();

  const { proveedor, productos } = result;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center gap-3">
          <Link href="/proveedores" className="text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{proveedor.nombre}</h1>
            <p className="text-sm text-gray-500 mt-0.5">NIT: {proveedor.nit}</p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            proveedor.tipo === 'consignacion' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {proveedor.tipo === 'consignacion' ? 'Consignación' : 'Directo'}
          </span>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            proveedor.activo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'
          }`}>
            {proveedor.activo ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>

      <div className="px-8 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel izquierdo: info + edición */}
        <div className="space-y-4">
          {/* Credenciales */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Acceso al portal</h2>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Usuario (NIT)</p>
                  <p className="text-sm font-medium text-gray-900 font-mono">{proveedor.nit}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Key className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Contraseña</p>
                  <p className="text-sm font-medium text-gray-900 font-mono">{proveedor.password}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Tag className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Tipo</p>
                  <p className="text-sm font-medium text-gray-900 capitalize">{proveedor.tipo}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400">Link de acceso del proveedor:</p>
              <p className="text-xs font-mono text-amber-700 mt-0.5 break-all">/p/login</p>
            </div>
          </div>

          {/* Editar proveedor */}
          <EditProveedorForm proveedor={proveedor} />
        </div>

        {/* Panel derecho: productos */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">
                Productos registrados
              </h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {productos.length}
              </span>
            </div>

            {productos.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">El proveedor aún no ha registrado productos</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {productos.map((prod: Producto) => (
                  <div key={prod.id} className="px-5 py-3.5 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{prod.nombre}</p>
                      {prod.descripcion && (
                        <p className="text-xs text-gray-500 mt-0.5">{prod.descripcion}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {new Date(prod.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
