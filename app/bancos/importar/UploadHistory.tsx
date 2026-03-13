'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileSpreadsheet, Trash2, Loader2, AlertTriangle } from 'lucide-react';

interface HistoryEntry {
  period: string;
  count: number;
  file: { name: string; created_at: string | null } | null;
}

const MONTH_NAMES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function formatPeriod(period: string): string {
  const [year, month] = period.split('-');
  return `${MONTH_NAMES[parseInt(month)]} ${year}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export default function UploadHistory({ refreshKey }: { refreshKey?: number }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/upload/bancolombia/history');
      const data = await res.json();
      const list: HistoryEntry[] = data.entries || [];
      setEntries(list);
      if (list.length > 0) {
        const years = [...new Set(list.map(e => e.period.split('-')[0]))].sort().reverse();
        setSelectedYear(prev => prev && years.includes(prev) ? prev : years[0]);
      }
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, refreshKey]);

  const handleDelete = async (period: string) => {
    setDeleting(period);
    setConfirmDelete(null);
    try {
      await fetch(`/api/upload/bancolombia/history?period=${period}`, { method: 'DELETE' });
      await fetchHistory();
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <Loader2 className="w-5 h-5 text-amber-500 mx-auto animate-spin" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
        No hay extractos importados aún.
      </div>
    );
  }

  const years = [...new Set(entries.map(e => e.period.split('-')[0]))].sort().reverse();
  const yearEntries = entries.filter(e => e.period.startsWith(selectedYear));

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header con selector de año */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-gray-800 shrink-0">
          Extractos importados <span className="text-gray-400 font-normal">({entries.length})</span>
        </h2>
        <div className="flex gap-1.5">
          {years.map(year => (
            <button
              key={year}
              onClick={() => { setSelectedYear(year); setConfirmDelete(null); }}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                selectedYear === year
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de meses del año seleccionado */}
      <ul className="divide-y divide-gray-100">
        {yearEntries.length === 0 ? (
          <li className="px-5 py-4 text-sm text-gray-400 text-center">
            No hay extractos para {selectedYear}
          </li>
        ) : (
          yearEntries.map(entry => (
            <li key={entry.period} className="px-5 py-4 flex items-center gap-3">
              <FileSpreadsheet className="w-5 h-5 text-green-600 shrink-0" />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{formatPeriod(entry.period)}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {entry.count} transacciones
                  {entry.file
                    ? ` · ${entry.file.name} · ${formatDate(entry.file.created_at)}`
                    : ' · archivo no en Storage'}
                </p>
              </div>

              {/* Acciones */}
              {confirmDelete === entry.period ? (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="flex items-center gap-1 text-xs text-orange-600">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    ¿Eliminar {entry.count} transacciones?
                  </span>
                  <button
                    onClick={() => handleDelete(entry.period)}
                    disabled={!!deleting}
                    className="px-2.5 py-1 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    {deleting === entry.period && <Loader2 className="w-3 h-3 animate-spin" />}
                    Confirmar
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(entry.period)}
                  disabled={!!deleting}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
