'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, ChevronDown } from 'lucide-react';
import CiudadSelector from './CiudadSelector';

const ID_TYPES = [
  { code: '31', label: 'NIT' },
  { code: '13', label: 'Cédula de ciudadanía' },
  { code: '22', label: 'Cédula de extranjería' },
  { code: '41', label: 'Pasaporte' },
  { code: '12', label: 'Tarjeta de identidad' },
  { code: '11', label: 'Registro civil' },
];


const defaultForm = {
  nit: '', nombre: '', person_type: 'Company', id_type_code: '31',
  direccion: '', ciudad_code: '', telefono: '', email: '',
  nombre_contacto: '',
};

export default function NuevoProveedorSiigo() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    setForm(f => ({
      ...f,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  }


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const res = await fetch('/api/proveedores/siigo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error || 'Error al crear en Siigo');
      return;
    }

    setOpen(false);
    setForm({ ...defaultForm });
    router.refresh();
  }

  const inputCls = "w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const selectCls = inputCls + " bg-white";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        Crear en Siigo
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-4">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Crear proveedor en Siigo</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">

              {/* Tipo de persona */}
              <Field label="Tipo de persona">
                <div className="grid grid-cols-2 gap-2">
                  {[{ v: 'Company', l: 'Jurídica (empresa)' }, { v: 'Person', l: 'Natural (persona)' }].map(opt => (
                    <label key={opt.v} className={`flex items-center gap-2 px-3.5 py-2.5 border rounded-lg cursor-pointer text-sm transition-colors ${
                      form.person_type === opt.v ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}>
                      <input type="radio" name="person_type" value={opt.v} checked={form.person_type === opt.v} onChange={handleChange} className="sr-only" />
                      {opt.l}
                    </label>
                  ))}
                </div>
              </Field>

              {/* Tipo de documento + identificación */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo de documento">
                  <div className="relative">
                    <select name="id_type_code" value={form.id_type_code} onChange={handleChange} className={selectCls}>
                      {ID_TYPES.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </Field>
                <Field label="NIT / Identificación" hint="Sin dígito de verificación">
                  <input name="nit" value={form.nit} onChange={handleChange} placeholder="900123456" className={inputCls} required />
                </Field>
              </div>

              {/* Razón social */}
              <Field label={form.person_type === 'Company' ? 'Razón social' : 'Nombre completo'}>
                <input name="nombre" value={form.nombre} onChange={handleChange} placeholder={form.person_type === 'Company' ? 'Ej: Saman WM S.A.S' : 'Nombre Apellido'} className={inputCls} required />
              </Field>

              {/* Dirección + Ciudad */}
              <Field label="Dirección">
                <input name="direccion" value={form.direccion} onChange={handleChange} placeholder="Calle 123 # 45-67" className={inputCls} />
              </Field>

              <Field label="Ciudad">
                <CiudadSelector
                  value={form.ciudad_code}
                  onChange={(code, state) => setForm(f => ({ ...f, ciudad_code: code, ciudad_state: state } as typeof f))}
                />
              </Field>

              {/* Teléfono + Email */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Teléfono">
                  <input name="telefono" value={form.telefono} onChange={handleChange} placeholder="3001234567" className={inputCls} />
                </Field>
                <Field label="Email">
                  <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="contacto@empresa.com" className={inputCls} />
                </Field>
              </div>

              {/* Nombre contacto (solo persona natural) */}
              {form.person_type === 'Person' && (
                <Field label="Nombre del contacto" hint="Si es diferente al nombre principal">
                  <input name="nombre_contacto" value={form.nombre_contacto} onChange={handleChange} placeholder="Nombre Apellido" className={inputCls} />
                </Field>
              )}


              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3.5 py-2.5 rounded-lg">{error}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg">
                  {saving ? 'Creando en Siigo...' : 'Crear proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
