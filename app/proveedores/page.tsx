import Link from 'next/link';
import { Building2, Package, ArrowRight } from 'lucide-react';
import { atelierTableAdmin } from '@/lib/supabase';

async function getCounts() {
  const [siigoRes, espaciosRes] = await Promise.all([
    atelierTableAdmin('suppliers').select('id', { count: 'exact', head: true }),
    atelierTableAdmin('proveedores').select('id', { count: 'exact', head: true }),
  ]);
  return {
    siigo: siigoRes.count ?? 0,
    espacios: espaciosRes.count ?? 0,
    espaciosActivos: 0,
  };
}

export default async function ProveedoresPage() {
  const counts = await getCounts();

  const cubes = [
    {
      href: '/proveedores/siigo',
      icon: Building2,
      title: 'Proveedores Siigo',
      description: 'Lista de todos los proveedores registrados en Siigo. Puedes consultar sus datos y crear nuevos proveedores directamente en Siigo desde aquí.',
      stat: counts.siigo,
      statLabel: 'proveedores en Siigo',
      color: 'blue',
    },
    {
      href: '/proveedores/espacios',
      icon: Package,
      title: 'Espacios de Proveedores',
      description: 'Crea y gestiona los accesos del portal para cada proveedor. Asigna usuario y contraseña para que puedan subir sus productos.',
      stat: counts.espacios,
      statLabel: 'espacios creados',
      color: 'amber',
    },
  ];

  const colorMap = {
    blue: {
      bg: 'bg-blue-50',
      icon: 'text-blue-600',
      stat: 'text-blue-700',
      border: 'hover:border-blue-300',
      arrow: 'text-blue-400 group-hover:text-blue-600',
    },
    amber: {
      bg: 'bg-amber-50',
      icon: 'text-amber-600',
      stat: 'text-amber-700',
      border: 'hover:border-amber-300',
      arrow: 'text-amber-400 group-hover:text-amber-600',
    },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gestiona proveedores de Siigo y sus espacios en el portal</p>
      </div>

      <div className="px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">
          {cubes.map((cube) => {
            const c = colorMap[cube.color as keyof typeof colorMap];
            const Icon = cube.icon;
            return (
              <Link
                key={cube.href}
                href={cube.href}
                className={`group bg-white border border-gray-200 rounded-2xl p-6 ${c.border} hover:shadow-md transition-all`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-11 h-11 ${c.bg} rounded-xl flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${c.icon}`} />
                  </div>
                  <ArrowRight className={`w-4 h-4 ${c.arrow} transition-colors mt-1`} />
                </div>

                <h2 className="text-base font-semibold text-gray-900 mb-1.5">{cube.title}</h2>
                <p className="text-sm text-gray-500 leading-relaxed mb-5">{cube.description}</p>

                <div className="pt-4 border-t border-gray-100">
                  <span className={`text-2xl font-bold ${c.stat}`}>{cube.stat}</span>
                  <span className="text-sm text-gray-400 ml-2">{cube.statLabel}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
