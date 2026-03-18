import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { fetchAllCustomers } from '@/lib/siigo';
import { atelierTableAdmin } from '@/lib/supabase';
import NuevoProveedorSiigo from './NuevoProveedorSiigo';
import TercerosLists from './TercerosLists';

async function getTerceros() {
  const [siigoTerceros, products] = await Promise.all([
    fetchAllCustomers(),
    atelierTableAdmin('products').select('supplier_id').not('supplier_id', 'is', null),
  ]);

  // Contar productos por supplier (para los que están en atelier_suppliers)
  const countMap: Record<string, number> = {};
  for (const p of (products.data || [])) {
    countMap[p.supplier_id] = (countMap[p.supplier_id] || 0) + 1;
  }

  const proveedores = siigoTerceros
    .filter(t => t.type === 'Supplier' || t.type === 'Provider')
    .map(t => ({
      id: t.id,
      name: t.name?.join(' ') || '',
      identification: t.identification,
      type: t.type,
      active: t.active,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const clientes = siigoTerceros
    .filter(t => t.type === 'Customer')
    .map(t => ({
      id: t.id,
      name: t.name?.join(' ') || '',
      identification: t.identification,
      type: t.type,
      active: t.active,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { proveedores, clientes };
}

export default async function ProveedoresSiigoPage() {
  const { proveedores, clientes } = await getTerceros();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/proveedores" className="text-gray-400 hover:text-gray-700 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Terceros Siigo</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {proveedores.length} proveedor{proveedores.length !== 1 ? 'es' : ''} · {clientes.length} cliente{clientes.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <NuevoProveedorSiigo />
        </div>
      </div>

      <div className="px-8 py-6">
        <TercerosLists proveedores={proveedores} clientes={clientes} />
      </div>
    </div>
  );
}
