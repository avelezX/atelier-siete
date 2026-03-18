import { NextRequest, NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';
import { getProveedorFromRequest } from '@/lib/proveedor-auth';

// Proveedor: listar sus productos
export async function GET(request: NextRequest) {
  const proveedor = getProveedorFromRequest(request);
  if (!proveedor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data, error } = await atelierTableAdmin('proveedor_productos')
    .select('id, nombre, descripcion, activo, created_at')
    .eq('proveedor_id', proveedor.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Proveedor: agregar producto
export async function POST(request: NextRequest) {
  const proveedor = getProveedorFromRequest(request);
  if (!proveedor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { nombre, descripcion } = await request.json();
  if (!nombre?.trim()) {
    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
  }

  const { data, error } = await atelierTableAdmin('proveedor_productos')
    .insert({ proveedor_id: proveedor.id, nombre: nombre.trim(), descripcion: descripcion?.trim() || null })
    .select('id, nombre, descripcion, activo, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
