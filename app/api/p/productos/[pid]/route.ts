import { NextRequest, NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';
import { getProveedorFromRequest } from '@/lib/proveedor-auth';

// Proveedor: editar producto
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ pid: string }> }) {
  const proveedor = getProveedorFromRequest(request);
  if (!proveedor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { pid } = await params;
  const { nombre, descripcion } = await request.json();

  // Verificar que el producto pertenece a este proveedor
  const { data: existing } = await atelierTableAdmin('proveedor_productos')
    .select('id')
    .eq('id', pid)
    .eq('proveedor_id', proveedor.id)
    .single();

  if (!existing) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (nombre !== undefined) updates.nombre = nombre.trim();
  if (descripcion !== undefined) updates.descripcion = descripcion?.trim() || null;

  const { data, error } = await atelierTableAdmin('proveedor_productos')
    .update(updates)
    .eq('id', pid)
    .select('id, nombre, descripcion, activo, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Proveedor: eliminar producto
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ pid: string }> }) {
  const proveedor = getProveedorFromRequest(request);
  if (!proveedor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { pid } = await params;

  const { error } = await atelierTableAdmin('proveedor_productos')
    .delete()
    .eq('id', pid)
    .eq('proveedor_id', proveedor.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
