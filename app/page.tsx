import { LayoutDashboard } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="flex items-center space-x-3 mb-8">
        <LayoutDashboard className="w-8 h-8 text-amber-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Atelier Siete — Muebles & Decoracion</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Facturas este mes</p>
          <p className="text-2xl font-bold text-gray-900">&mdash;</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Notas Credito</p>
          <p className="text-2xl font-bold text-gray-900">&mdash;</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Productos</p>
          <p className="text-2xl font-bold text-gray-900">&mdash;</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Clientes</p>
          <p className="text-2xl font-bold text-gray-900">&mdash;</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-gray-500">
          Configura las credenciales de Siigo en <code className="bg-gray-100 px-2 py-1 rounded text-sm">.env.local</code> para comenzar.
        </p>
      </div>
    </div>
  );
}
