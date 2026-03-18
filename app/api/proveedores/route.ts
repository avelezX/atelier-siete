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

// Admin: listar todos los proveedores
export async function GET() {
  const { data, error } = await atelierTableAdmin('proveedores')
    .select('id, nit, nombre, tipo, activo, created_at')
    .order('nombre');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Admin: crear espacio de proveedor + usuario en Supabase Auth
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nit, nombre, tipo, password } = body;

  if (!nit || !nombre || !tipo || !password) {
    return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 });
  }

  const email = `${nit.trim()}@proveedores.ateliersie7.co`;

  // 1. Crear usuario en Supabase Auth
  const authAdmin = createAdminAuthClient();
  const { data: authData, error: authError } = await authAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // sin necesidad de confirmar email
    app_metadata: { role: 'proveedor', nit: nit.trim() },
    user_metadata: { nombre: nombre.trim() },
  });

  if (authError) {
    // Si el usuario ya existe en Auth, continuamos (puede ser una re-creación de espacio)
    if (!authError.message.includes('already been registered')) {
      return NextResponse.json({ error: `Error en Auth: ${authError.message}` }, { status: 500 });
    }
  }

  // 2. Guardar espacio en atelier_proveedores
  const { data, error } = await atelierTableAdmin('proveedores')
    .insert({ nit: nit.trim(), nombre: nombre.trim(), tipo })
    .select('id, nit, nombre, tipo, activo, created_at')
    .single();

  if (error) {
    // Si ya existe, actualizarlo
    if (error.code === '23505') {
      const { data: existing } = await atelierTableAdmin('proveedores')
        .select('id, nit, nombre, tipo, activo, created_at')
        .eq('nit', nit.trim())
        .single();
      return NextResponse.json(existing, { status: 200 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
