'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Supplier { id: string; name: string; nit: string; type: string; }

export default function NuevoEspacioForm({ suppliers }: { suppliers: Supplier[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ supplier_id: '', nombre: '', nit: '', tipo: 'directo', password: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function handleSupplierChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    const supplier = suppliers.find(s => s.id === id);
    setForm(f => ({ ...f, supplier_id: id, nombre: supplier?.name || '', nit: supplier?.nit || '' }));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const res = await fetch('/api/proveedores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nit: form.nit,
        nombre: form.nombre,
        tipo: form.tipo,
        password: form.password,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Error al crear espacio');
      setSaving(false);
      return;
    }

    router.push(`/proveedores/espacios/${data.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">

      {/* Selector de proveedor Siigo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Proveedor de Siigo
        </label>
        <select
          value={form.supplier_id}
          onChange={handleSupplierChange}
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
        >
          <option value="">— Selecciona un tercero de Siigo —</option>
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.name} {s.nit ? `· ${s.nit}` : ''}</option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">
          Si el proveedor no aparece, agrégalo primero en{' '}
          <Link href="/proveedores/siigo" className="text-amber-600 hover:underline">Proveedores Siigo</Link>
        </p>
      </div>

      {/* Nombre (editable, auto-rellena del selector) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre / Razón social</label>
        <input
          name="nombre"
          value={form.nombre}
          onChange={handleChange}
          placeholder="Se rellena al seleccionar, o escribe manualmente"
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          required
        />
      </div>

      {/* NIT */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">NIT</label>
        <input
          name="nit"
          value={form.nit}
          onChange={handleChange}
          placeholder="Ej: 900123456"
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          required
        />
        <p className="text-xs text-gray-400 mt-1">Este NIT será el usuario de acceso del proveedor</p>
      </div>

      {/* Tipo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de proveedor</label>
        <select
          name="tipo"
          value={form.tipo}
          onChange={handleChange}
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
        >
          <option value="directo">Directo</option>
          <option value="consignacion">Consignación</option>
        </select>
      </div>

      {/* Contraseña */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña de acceso</label>
        <input
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Clave que el proveedor usará para ingresar"
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          required
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3.5 py-2.5 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <Link
          href="/proveedores/espacios"
          className="flex-1 text-center py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg"
        >
          {saving ? 'Creando...' : 'Crear espacio'}
        </button>
      </div>
    </form>
  );
}
