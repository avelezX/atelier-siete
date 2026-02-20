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
  price?: Array<{
    currency_code: string;
    price_list: Array<{ position: number; value: number }>;
  }>;
  unit?: { name: string };
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadProducts() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/siigo/products');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setProducts(data.results || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProducts(); }, []);

  function getPrice(product: Product): number | null {
    const priceEntry = product.price?.[0]?.price_list?.[0];
    return priceEntry ? priceEntry.value : null;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Package className="w-8 h-8 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
            <p className="text-gray-500">{products.length} productos en Siigo</p>
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
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Unidad</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Precio</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Inventario</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">Cargando...</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">No hay productos</td></tr>
            ) : (
              products.map((prod) => {
                const price = getPrice(prod);
                return (
                  <tr key={prod.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm text-gray-900">{prod.code}</td>
                    <td className="px-4 py-3 text-gray-900">{prod.name}</td>
                    <td className="px-4 py-3 text-gray-600">{prod.unit?.name || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {price !== null ? formatCurrency(price) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {prod.stock_control ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">Si</span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-500">No</span>
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
