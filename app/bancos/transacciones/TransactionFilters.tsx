'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { useState } from 'react';

const START_YEAR = 2023;
const CURRENT_YEAR = new Date().getFullYear() + 1;

const YEARS = Array.from({ length: CURRENT_YEAR - START_YEAR + 1 }, (_, i) => String(START_YEAR + i));

const MONTHS = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

export default function TransactionFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchValue, setSearchValue] = useState(searchParams.get('search') || '');
  const typeFilter = searchParams.get('type') || 'all';
  const yearFilter = searchParams.get('year') || '';
  const monthFilter = searchParams.get('month') || '';

  const updateParam = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value && value !== 'all') {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    params.set('page', '1');
    router.push(`?${params.toString()}`);
  };

  const clearFilter = (...keys: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    keys.forEach(k => params.delete(k));
    params.set('page', '1');
    router.push(`?${params.toString()}`);
  };

  const clearAllFilters = () => {
    router.push('?page=1');
    setSearchValue('');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam({ search: searchValue });
  };

  const monthLabel = monthFilter ? MONTHS.find(m => m.value === monthFilter)?.label : null;
  const hasFilters = searchParams.get('search') || typeFilter !== 'all' || yearFilter || monthFilter;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <form onSubmit={handleSearchSubmit}>
          <label className="block text-xs font-medium text-gray-700 mb-1">Buscar</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por descripción..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>
          <button type="submit" className="hidden">Buscar</button>
        </form>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
          <select
            value={typeFilter}
            onChange={(e) => updateParam({ type: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          >
            <option value="all">Todos</option>
            <option value="credit">Ingresos (créditos)</option>
            <option value="debit">Gastos (débitos)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Año</label>
          <select
            value={yearFilter}
            title="Filtrar por año"
            onChange={(e) => updateParam({ year: e.target.value, month: monthFilter })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          >
            <option value="">Todos los años</option>
            {YEARS.slice().reverse().map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Mes</label>
          <select
            value={monthFilter}
            title="Filtrar por mes"
            onChange={(e) => updateParam({ year: yearFilter, month: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          >
            <option value="">Todos los meses</option>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {hasFilters && (
        <div className="mt-4 flex items-center flex-wrap gap-2">
          <span className="text-xs text-gray-500">Filtros activos:</span>

          {searchParams.get('search') && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              Búsqueda: {searchParams.get('search')}
              <button onClick={() => { clearFilter('search'); setSearchValue(''); }} className="ml-1.5 hover:text-amber-900">×</button>
            </span>
          )}

          {typeFilter !== 'all' && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Tipo: {typeFilter === 'credit' ? 'Ingresos' : 'Gastos'}
              <button onClick={() => clearFilter('type')} className="ml-1.5 hover:text-green-900">×</button>
            </span>
          )}

          {yearFilter && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
              Año: {yearFilter}
              <button onClick={() => clearFilter('year')} className="ml-1.5 hover:text-orange-900">×</button>
            </span>
          )}

          {monthFilter && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
              Mes: {monthLabel || monthFilter}
              <button onClick={() => clearFilter('month')} className="ml-1.5 hover:text-orange-900">×</button>
            </span>
          )}

          <button onClick={clearAllFilters} className="text-xs text-gray-500 hover:text-gray-700 underline">
            Limpiar todo
          </button>
        </div>
      )}
    </div>
  );
}
