'use client';

import { useState, useEffect } from 'react';
import { Users, RefreshCw } from 'lucide-react';

interface Customer {
  id: string;
  identification: string;
  name: string[];
  commercial_name?: string;
  type: string;
  active: boolean;
  contacts?: Array<{ email: string; phone?: { number: string } }>;
  phones?: Array<{ number: string }>;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadCustomers() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/siigo/customers');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCustomers(data.results || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCustomers(); }, []);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Users className="w-8 h-8 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
            <p className="text-gray-500">{customers.length} clientes en Siigo</p>
          </div>
        </div>
        <button
          onClick={loadCustomers}
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
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Identificacion</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Contacto</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-500">Cargando...</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-500">No hay clientes</td></tr>
            ) : (
              customers.map((cust) => {
                const email = cust.contacts?.[0]?.email || '';
                const phone = cust.phones?.[0]?.number || cust.contacts?.[0]?.phone?.number || '';
                return (
                  <tr key={cust.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm text-gray-900">{cust.identification}</td>
                    <td className="px-4 py-3 text-gray-900">
                      {cust.name?.join(' ') || cust.commercial_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{cust.type}</td>
                    <td className="px-4 py-3 text-gray-600 text-sm">
                      {email && <div>{email}</div>}
                      {phone && <div>{phone}</div>}
                      {!email && !phone && '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {cust.active ? (
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
