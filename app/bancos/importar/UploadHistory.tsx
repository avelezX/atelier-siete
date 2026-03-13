'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileSpreadsheet, Trash2, Loader2, AlertTriangle } from 'lucide-react';

interface HistoryEntry {
  period: string;
  count: number;
  file: { name: string; created_at: string | null } | null;
}

function formatPeriod(period: string): string {
  const months = [
    '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  const [year, month] = period.split('-');
  return `${months[parseInt(month)]} ${year}`;
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
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/upload/bancolombia/history');
      const data = await res.json();
      setEntries(data.entries || []);
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
        <Loader2 className="w-6 h-6 text-amber-500 mx-auto animate-spin" />
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

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800">Extractos importados</h2>
      </div>

      <ul className="divide-y divide-gray-100">
        {entries.map((entry) => (
          <li key={entry.period} className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <FileSpreadsheet className="w-5 h-5 text-green-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{formatPeriod(entry.period)}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {entry.count} transacciones
                  {entry.file ? ` · ${entry.file.name} · subido ${formatDate(entry.file.created_at)}` : ' · archivo no encontrado en Storage'}
                </p>
              </div>
            </div>

            <div className="shrink-0">
              {confirmDelete === entry.period ? (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  <span className="text-xs text-gray-600">¿Eliminar {entry.count} transacciones?</span>
                  <button
                    onClick={() => handleDelete(entry.period)}
                    disabled={!!deleting}
                    className="px-2.5 py-1 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting === entry.period ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirmar'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(entry.period)}
                  disabled={!!deleting}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Eliminar extracto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
