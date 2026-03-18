import { NextRequest, NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

function createAdminAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Admin: ver un proveedor con sus productos
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [provRes, prodRes] = await Promise.all([
    atelierTableAdmin('proveedores')
      .select('id, nit, nombre, tipo, activo, created_at')
      .eq('id', id)
      .single(),
    atelierTableAdmin('proveedor_productos')
      .select('id, nombre, descripcion, activo, created_at')
      .eq('proveedor_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (provRes.error) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
  return NextResponse.json({ ...provRes.data, productos: prodRes.data || [] });
}

// Admin: editar proveedor (nombre, tipo, activo, password)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  const allowed = ['nombre', 'tipo', 'activo', 'password'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await atelierTableAdmin('proveedores')
    .update(updates)
    .eq('id', id)
    .select('id, nit, nombre, tipo, activo')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Admin: eliminar espacio de proveedor + usuario en Auth
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Obtener NIT para eliminar usuario de Auth
  const { data: proveedor } = await atelierTableAdmin('proveedores')
    .select('id, nit')
    .eq('id', id)
    .single();

  if (!proveedor) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });

  // Eliminar usuario de Supabase Auth
  const authAdmin = createAdminAuthClient();
  const email = `${proveedor.nit}@proveedores.ateliersie7.co`;
  const { data: users } = await authAdmin.auth.admin.listUsers();
  const authUser = users?.users?.find((u: any) => u.email === email);
  if (authUser) {
    await authAdmin.auth.admin.deleteUser(authUser.id);
  }

  // Eliminar de atelier_proveedores (cascade elimina sus productos)
  const { error } = await atelierTableAdmin('proveedores').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
