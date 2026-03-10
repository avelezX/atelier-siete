'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  FileMinus2,
  Package,
  Users,
  Settings,
  ChevronRight,
  RefreshCw,
  Truck,
  TrendingUp,
  Receipt,
  BarChart3,
  AlertTriangle,
  Calculator,
  Landmark,
  DollarSign,
  BookOpen,
  Wrench,
  Warehouse,
  Scale,
} from "lucide-react";

interface MenuItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const menuSections: MenuSection[] = [
  {
    title: "Principal",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
      { name: "Resumen", href: "/resumen", icon: BarChart3 },
      { name: "Ventas", href: "/ventas", icon: TrendingUp },
      { name: "IVA", href: "/iva", icon: Receipt },
      { name: "Renta y Retencion", href: "/retencion", icon: Landmark },
      { name: "Costo Cero", href: "/costo-cero", icon: AlertTriangle },
      { name: "Costos Estimados", href: "/costos-estimados", icon: Calculator },
      { name: "Costos Reales", href: "/cost-tracking", icon: DollarSign },
      { name: "Corrección Costos", href: "/correccion-costos", icon: Wrench },
      { name: "Inventario Propio", href: "/inventario", icon: Warehouse },
      { name: "Saldos Inventario", href: "/saldos", icon: Package },
      { name: "Comparar Balance", href: "/comparar-balance", icon: Scale },
    ]
  },
  {
    title: "Siigo",
    items: [
      { name: "Facturas", href: "/invoices", icon: FileText },
      { name: "Notas Credito", href: "/credit-notes", icon: FileMinus2 },
      { name: "Productos", href: "/products", icon: Package },
      { name: "Clientes", href: "/customers", icon: Users },
    ]
  },
  {
    title: "Datos",
    items: [
      { name: "Sincronizacion", href: "/sync", icon: RefreshCw },
      { name: "Proveedores", href: "/suppliers", icon: Truck },
    ]
  },
  {
    title: "Configuracion",
    items: [
      { name: "Ajustes", href: "/settings", icon: Settings },
      { name: "Documentacion", href: "/documentacion", icon: BookOpen },
    ]
  }
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col w-64 bg-white border-r border-gray-200 h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center space-x-3 px-6 py-6 border-b border-gray-200">
        <div className="w-10 h-10 bg-gradient-to-br from-amber-600 to-orange-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-xl">A</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Atelier Siete</h1>
          <p className="text-xs text-gray-500">Muebles & Decoracion</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {menuSections.map((section) => (
          <div key={section.title} className="mb-6">
            <h3 className="px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {section.title}
            </h3>
            <div className="space-y-1 px-3">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-amber-50 text-amber-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-amber-700' : 'text-gray-500'}`} />
                    <span className="flex-1">{item.name}</span>
                    {isActive && <ChevronRight className="w-4 h-4 text-amber-700" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4">
        <div className="px-3 py-2 bg-amber-50 rounded-lg">
          <p className="text-xs font-medium text-amber-900">Version 1.0</p>
          <p className="text-xs text-amber-700">Beta</p>
        </div>
      </div>
    </div>
  );
}
