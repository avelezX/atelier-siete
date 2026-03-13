import { atelierTableAdmin } from '@/lib/supabase';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Search } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import TransactionFilters from './TransactionFilters';
import CategorySelector from '@/components/CategorySelector';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  searchParams: {
    page?: string;
    search?: string;
    type?: string;
    year?: string;
    month?: string;
  };
}

export default async function TransaccionesPage({ searchParams }: PageProps) {
  const page = parseInt(searchParams.page || '1');
  const pageSize = 50;
  const searchQuery = searchParams.search || '';
  const typeFilter = searchParams.type || 'all';
  const yearFilter = searchParams.year || '';
  const monthFilter = searchParams.month || '';

  let query = atelierTableAdmin('transactions')
    .select('*', { count: 'exact' })
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (searchQuery) {
    query = query.ilike('description', `%${searchQuery}%`);
  }
  if (typeFilter !== 'all') {
    query = query.eq('type', typeFilter);
  }
  if (yearFilter && monthFilter) {
    const startDate = `${yearFilter}-${monthFilter}-01`;
    const endDate = new Date(parseInt(yearFilter), parseInt(monthFilter), 0).toISOString().split('T')[0];
    query = query.gte('date', startDate).lte('date', endDate);
  } else if (yearFilter) {
    query = query.gte('date', `${yearFilter}-01-01`).lte('date', `${yearFilter}-12-31`);
  } else if (monthFilter) {
    const year = new Date().getFullYear();
    const startDate = `${year}-${monthFilter}-01`;
    const endDate = new Date(year, parseInt(monthFilter), 0).toISOString().split('T')[0];
    query = query.gte('date', startDate).lte('date', endDate);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data: transactions, error, count } = await query;

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="text-red-800 text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  const totalPages = count ? Math.ceil(count / pageSize) : 0;
  const totalCredits = transactions?.reduce((s: number, t: any) => t.type === 'credit' ? s + Number(t.amount) : s, 0) || 0;
  const totalDebits = transactions?.reduce((s: number, t: any) => t.type === 'debit' ? s + Number(t.amount) : s, 0) || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <h1 className="text-2xl font-bold text-gray-900">Transacciones</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {count ? count.toLocaleString() : 0} transacciones
        </p>
      </div>

      <div className="px-8 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-medium text-gray-500">Ingresos (página)</h3>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-xl font-bold text-green-600">{formatCurrency(totalCredits)}</p>
            <p className="text-xs text-gray-400 mt-1">{transactions?.filter((t: any) => t.type === 'credit').length || 0} transacciones</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-medium text-gray-500">Gastos (página)</h3>
              <TrendingDown className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-xl font-bold text-red-600">{formatCurrency(totalDebits)}</p>
            <p className="text-xs text-gray-400 mt-1">{transactions?.filter((t: any) => t.type === 'debit').length || 0} transacciones</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-medium text-gray-500">Balance neto</h3>
            </div>
            <p className={`text-xl font-bold ${totalCredits - totalDebits >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalCredits - totalDebits)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Página actual</p>
          </div>
        </div>

        {/* Filters */}
        <Suspense>
          <TransactionFilters />
        </Suspense>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Descripción</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Referencia</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Monto</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Saldo</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Categoría</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions && transactions.length > 0 ? (
                  transactions.map((t: any) => (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-700">
                        {new Date(t.date).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-900">
                        <div className="max-w-xs">
                          {t.description}
                          {t.branch && <span className="block text-xs text-gray-400 mt-0.5">Sucursal: {t.branch}</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-500">{t.reference || '—'}</td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-right">
                        <span className={`font-semibold ${t.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                          {t.type === 'credit' ? '+' : '−'} {formatCurrency(Number(t.amount))}
                        </span>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                        {formatCurrency(Number(t.balance))}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-center">
                        <CategorySelector transactionId={t.id} currentCategory={t.category} compact />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                      <Search className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                      <p>No se encontraron transacciones</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="bg-gray-50 px-5 py-4 border-t border-gray-200 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Página <strong>{page}</strong> de <strong>{totalPages}</strong> ({count?.toLocaleString()} total)
              </p>
              <div className="flex gap-2">
                <Link
                  href={`?${new URLSearchParams({ ...(searchQuery && { search: searchQuery }), ...(typeFilter !== 'all' && { type: typeFilter }), ...(yearFilter && { year: yearFilter }), ...(monthFilter && { month: monthFilter }), page: (page - 1).toString() }).toString()}`}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg ${page === 1 ? 'bg-gray-100 text-gray-400 pointer-events-none' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}
                >
                  ← Anterior
                </Link>
                <Link
                  href={`?${new URLSearchParams({ ...(searchQuery && { search: searchQuery }), ...(typeFilter !== 'all' && { type: typeFilter }), ...(yearFilter && { year: yearFilter }), ...(monthFilter && { month: monthFilter }), page: (page + 1).toString() }).toString()}`}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg ${page === totalPages ? 'bg-gray-100 text-gray-400 pointer-events-none' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}
                >
                  Siguiente →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
