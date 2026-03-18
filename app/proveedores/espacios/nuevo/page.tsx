import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { fetchAllCustomers } from '@/lib/siigo';
import NuevoEspacioForm from './NuevoEspacioForm';

async function getSiigoSuppliers() {
  const all = await fetchAllCustomers();
  return all
    .map(t => ({
      id: t.id,
      name: t.name?.join(' ') || '',
      nit: t.identification || '',
      type: t.type,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default async function NuevoEspacioPage() {
  const suppliers = await getSiigoSuppliers();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center gap-3">
          <Link href="/proveedores/espacios" className="text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nuevo espacio</h1>
            <p className="text-sm text-gray-500 mt-0.5">Crea un acceso al portal para un proveedor de Siigo</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-8 py-8">
        <NuevoEspacioForm suppliers={suppliers} />
      </div>
    </div>
  );
}
