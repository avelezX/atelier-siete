'use client';

import { useState, useEffect } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import { formatCurrency, formatDateShort } from '@/lib/utils';

interface Invoice {
  id: string;
  name: string;
  date: string;
  customer: { name?: string[]; identification: string };
  total: number;
  balance: number;
  annulled?: boolean;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  async function loadInvoices(p: number = 1) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/siigo/invoices?page=${p}&page_size=25`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setInvoices(data.results || []);
      setTotal(data.pagination?.total_results || 0);
      setPage(p);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadInvoices(); }, []);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <FileText className="w-8 h-8 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Facturas</h1>
            <p className="text-gray-500">{total} facturas en Siigo</p>
          </div>
        </div>
        <button
          onClick={() => loadInvoices(page)}
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
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Numero</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cliente</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Saldo</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">Cargando...</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">No hay facturas</td></tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{inv.name}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDateShort(inv.date)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {inv.customer?.name?.join(' ') || inv.customer?.identification || '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(inv.total)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(inv.balance)}</td>
                  <td className="px-4 py-3 text-center">
                    {inv.annulled ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">Anulada</span>
                    ) : inv.balance === 0 ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Pagada</span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">Pendiente</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 25 && (
        <div className="flex justify-center space-x-2 mt-4">
          <button
            onClick={() => loadInvoices(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="px-3 py-1 text-sm text-gray-600">
            Pagina {page} de {Math.ceil(total / 25)}
          </span>
          <button
            onClick={() => loadInvoices(page + 1)}
            disabled={page >= Math.ceil(total / 25)}
            className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
