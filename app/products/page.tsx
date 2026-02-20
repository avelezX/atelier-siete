'use client';

import { useState, useEffect } from 'react';
import { Package, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Product {
  id: string;
  code: string;
  name: string;
  active: boolean;
  stock_control?: boolean;
  tax_classification?: string;
  reference?: string;
  available_quantity?: number;
  account_group?: { id: number; name: string };
  prices?: Array<{
    currency_code: string;
    price_list: Array<{ position: number; value: number }>;
  }>;
  unit?: { name: string };
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'consignment' | 'own'>('all');

  async function loadProducts() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/siigo/products');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setProducts(data.results || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProducts(); }, []);

  function getPrice(product: Product): number | null {
    const priceEntry = product.prices?.[0]?.price_list?.[0];
    return priceEntry ? priceEntry.value : null;
  }

  function isConsignment(product: Product): boolean {
    return product.account_group?.name === 'Productos en Consignación';
  }

  const filtered = products.filter((p) => {
    if (filter === 'consignment') return isConsignment(p);
    if (filter === 'own') return !isConsignment(p);
    return true;
  });

  const consignmentCount = products.filter(isConsignment).length;
  const ownCount = products.length - consignmentCount;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Package className="w-8 h-8 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
            <p className="text-gray-500">
              {products.length} productos ({consignmentCount} consignacion, {ownCount} propios)
            </p>
          </div>
        </div>
        <button
          onClick={loadProducts}
          className="flex items-center space-x-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex space-x-2 mb-4">
        {[
          { key: 'all' as const, label: `Todos (${products.length})` },
          { key: 'consignment' as const, label: `Consignacion (${consignmentCount})` },
          { key: 'own' as const, label: `Propios (${ownCount})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === tab.key
                ? 'bg-amber-100 text-amber-800 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Codigo</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Proveedor</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Precio</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stock</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-500">Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-500">No hay productos</td></tr>
            ) : (
              filtered.map((prod) => {
                const price = getPrice(prod);
                const consig = isConsignment(prod);
                return (
                  <tr key={prod.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm text-gray-900">{prod.code}</td>
                    <td className="px-4 py-3 text-gray-900">{prod.name}</td>
                    <td className="px-4 py-3 text-gray-600 text-sm">{prod.reference || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {price !== null ? formatCurrency(price) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center font-medium">
                      {prod.available_quantity ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {consig ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700">Consignacion</span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">Propio</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {prod.active ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Activo</span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">Inactivo</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
