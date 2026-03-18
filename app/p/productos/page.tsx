'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Plus, Pencil, Trash2, LogOut, Check, X } from 'lucide-react';

interface Producto {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
}

export default function ProveedorProductosPage() {
  const router = useRouter();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Estado del formulario nuevo producto
  const [showForm, setShowForm] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);

  // Estado de edición inline
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Estado de confirmación de borrado
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchProductos = useCallback(async () => {
    try {
      const res = await fetch('/api/p/productos');
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setProductos(Array.isArray(data) ? data : []);
    } catch {
      setError('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchProductos(); }, [fetchProductos]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/p/productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: newNombre, descripcion: newDesc }),
    });
    if (res.ok) {
      setNewNombre(''); setNewDesc(''); setShowForm(false);
      fetchProductos();
    }
    setSaving(false);
  }

  async function handleEdit(id: string) {
    const res = await fetch(`/api/p/productos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: editNombre, descripcion: editDesc }),
    });
    if (res.ok) { setEditId(null); fetchProductos(); }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/p/productos/${id}`, { method: 'DELETE' });
    if (res.ok) { setDeleteId(null); fetchProductos(); }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  function startEdit(p: Producto) {
    setEditId(p.id);
    setEditNombre(p.nombre);
    setEditDesc(p.descripcion || '');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900">Mis Productos</h1>
              <p className="text-xs text-gray-500">Portal Proveedores · Atelier Siete</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6">
        {/* Acción agregar */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">{productos.length} producto{productos.length !== 1 ? 's' : ''}</p>
          <button
            onClick={() => { setShowForm(true); setEditId(null); }}
            className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Agregar producto
          </button>
        </div>

        {/* Formulario nuevo producto */}
        {showForm && (
          <form onSubmit={handleAdd} className="bg-white border border-amber-200 rounded-xl p-4 mb-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-800">Nuevo producto</h3>
            <input
              autoFocus
              value={newNombre}
              onChange={e => setNewNombre(e.target.value)}
              placeholder="Nombre del producto *"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            />
            <textarea
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Descripción (opcional)"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        )}

        {/* Lista */}
        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Cargando...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-500 text-sm">{error}</div>
        ) : productos.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Aún no tienes productos registrados</p>
            <p className="text-xs text-gray-400 mt-1">Agrega tu primer producto con el botón de arriba</p>
          </div>
        ) : (
          <div className="space-y-2">
            {productos.map(p => (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                {editId === p.id ? (
                  // Edición inline
                  <div className="space-y-2">
                    <input
                      autoFocus
                      value={editNombre}
                      onChange={e => setEditNombre(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <textarea
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditId(null)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg">
                        <X className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleEdit(p.id)} className="p-1.5 text-amber-600 hover:text-amber-800 rounded-lg">
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  // Vista normal
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{p.nombre}</p>
                      {p.descripcion && (
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{p.descripcion}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {deleteId === p.id ? (
                        <>
                          <span className="text-xs text-red-600 mr-1">¿Eliminar?</span>
                          <button onClick={() => handleDelete(p.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteId(null)} className="p-1.5 text-gray-400 hover:bg-gray-50 rounded-lg">
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(p)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteId(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
