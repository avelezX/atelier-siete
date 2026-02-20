'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
  Package,
  FileText,
  Users,
  FileMinus2,
  Truck,
} from 'lucide-react';

interface SyncStatus {
  lastSync: {
    id: string;
    completed_at: string;
    records_fetched: number;
    records_upserted: number;
    status: string;
    details: Record<string, number>;
  } | null;
  currentSync: {
    id: string;
    started_at: string;
    status: string;
  } | null;
  counts: {
    products: number;
    invoices: number;
    customers: number;
    credit_notes: number;
    suppliers: number;
  };
}

export default function SyncPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/sync/status');
      const data = await res.json();
      setStatus(data);
      if (data.currentSync) setSyncing(true);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Poll while syncing
  useEffect(() => {
    if (!syncing) return;
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, [syncing, loadStatus]);

  async function startSync() {
    setSyncing(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Error desconocido');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error de conexion');
    } finally {
      setSyncing(false);
      loadStatus();
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const statCards = [
    {
      label: 'Productos',
      count: status?.counts?.products || 0,
      icon: Package,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Facturas',
      count: status?.counts?.invoices || 0,
      icon: FileText,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Clientes',
      count: status?.counts?.customers || 0,
      icon: Users,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Notas Credito',
      count: status?.counts?.credit_notes || 0,
      icon: FileMinus2,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'Proveedores',
      count: status?.counts?.suppliers || 0,
      icon: Truck,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <Database className="w-8 h-8 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Sincronizacion
            </h1>
            <p className="text-gray-500">
              Siigo → Supabase
            </p>
          </div>
        </div>
        <button
          onClick={startSync}
          disabled={syncing}
          className="flex items-center space-x-2 px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Sincronizando...' : 'Sincronizar Todo'}</span>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-start space-x-3">
          <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Error en sincronizacion</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Success result */}
      {result && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 flex items-start space-x-3">
          <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Sincronizacion completada</p>
            <p className="text-sm mt-1">
              {(result.totalFetched as number)?.toLocaleString()} registros
              descargados de Siigo
            </p>
          </div>
        </div>
      )}

      {/* Syncing indicator */}
      {syncing && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg mb-6 flex items-center space-x-3">
          <RefreshCw className="w-5 h-5 animate-spin flex-shrink-0" />
          <div>
            <p className="font-medium">Sincronizando datos desde Siigo...</p>
            <p className="text-sm mt-1">
              Esto puede tomar 1-3 minutos dependiendo del volumen de datos.
            </p>
          </div>
        </div>
      )}

      {/* Record counts */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <div className="flex items-center space-x-2 mb-2">
                <div className={`p-1.5 rounded-lg ${card.bg}`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
                <span className="text-sm text-gray-500">{card.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '—' : card.count.toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>

      {/* Last sync info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <Clock className="w-5 h-5 text-gray-500" />
          <span>Ultima Sincronizacion</span>
        </h2>

        {status?.lastSync ? (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-700">
                {formatDate(status.lastSync.completed_at)}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Descargados:</span>{' '}
                <span className="font-medium">
                  {status.lastSync.records_fetched?.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Guardados:</span>{' '}
                <span className="font-medium">
                  {status.lastSync.records_upserted?.toLocaleString()}
                </span>
              </div>
            </div>
            {status.lastSync.details && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Detalle:</p>
                <div className="flex flex-wrap gap-3 text-xs">
                  {Object.entries(status.lastSync.details).map(
                    ([key, val]) => (
                      <span
                        key={key}
                        className="px-2 py-1 bg-gray-50 rounded text-gray-600"
                      >
                        {key}: {(val as number).toLocaleString()}
                      </span>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">
            {loading
              ? 'Cargando...'
              : 'No se ha realizado ninguna sincronizacion. Haz click en "Sincronizar Todo" para comenzar.'}
          </p>
        )}
      </div>
    </div>
  );
}
