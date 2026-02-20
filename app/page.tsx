'use client';

import { useState, useEffect } from 'react';
import { LayoutDashboard, TrendingUp, Receipt, FileText, Package, Users, Truck } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

interface SyncStatus {
  last_sync: {
    status: string;
    completed_at: string;
    details: Record<string, number>;
  } | null;
  counts: Record<string, number>;
}

export default function DashboardPage() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/sync/status');
        const data = await res.json();
        setSyncStatus(data);
      } catch {
        // Silently fail - dashboard still shows navigation
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const counts = syncStatus?.counts || {};
  const lastSync = syncStatus?.last_sync;

  return (
    <div className="p-8">
      <div className="flex items-center space-x-3 mb-8">
        <LayoutDashboard className="w-8 h-8 text-amber-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Atelier Siete — Muebles & Decoracion</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-2">
            <FileText className="w-5 h-5 text-amber-600" />
            <p className="text-sm text-gray-500">Facturas</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {loading ? '...' : (counts.invoices ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-2">
            <Package className="w-5 h-5 text-amber-600" />
            <p className="text-sm text-gray-500">Productos</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {loading ? '...' : (counts.products ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-2">
            <Users className="w-5 h-5 text-amber-600" />
            <p className="text-sm text-gray-500">Clientes</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {loading ? '...' : (counts.customers ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-2">
            <Truck className="w-5 h-5 text-amber-600" />
            <p className="text-sm text-gray-500">Proveedores</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {loading ? '...' : (counts.suppliers ?? 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Quick Access */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Link
          href="/ventas"
          className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center space-x-3 mb-2">
            <TrendingUp className="w-6 h-6 text-amber-700" />
            <h2 className="text-lg font-semibold text-gray-900">Ventas por Mes</h2>
          </div>
          <p className="text-sm text-gray-600">
            Ver todas las ventas filtradas por mes, con subtotales por proveedor y
            clasificacion consignacion vs producto propio.
          </p>
        </Link>

        <Link
          href="/iva"
          className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center space-x-3 mb-2">
            <Receipt className="w-6 h-6 text-amber-700" />
            <h2 className="text-lg font-semibold text-gray-900">IVA</h2>
          </div>
          <p className="text-sm text-gray-600">
            Ver IVA facturado, cobrado, pendiente y devuelto por notas credito.
            Desglose por proveedor.
          </p>
        </Link>
      </div>

      {/* Last sync info */}
      {lastSync && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Ultima Sincronizacion</h3>
          <div className="flex items-center space-x-4 text-sm">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              lastSync.status === 'completed'
                ? 'bg-green-100 text-green-700'
                : lastSync.status === 'running'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {lastSync.status === 'completed' ? 'Completada' : lastSync.status === 'running' ? 'En progreso' : 'Error'}
            </span>
            {lastSync.completed_at && (
              <span className="text-gray-500">
                {new Date(lastSync.completed_at).toLocaleString('es-CO')}
              </span>
            )}
            <Link href="/sync" className="text-amber-600 hover:text-amber-700 underline">
              Ver detalles
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
