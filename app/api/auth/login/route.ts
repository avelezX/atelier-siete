import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function nitToEmail(nit: string): string {
  const atelierNit = process.env.ATELIER_NIT || '901764924';
  if (nit.trim() === atelierNit) return `admin@ateliersie7.co`;
  return `${nit.trim()}@proveedores.ateliersie7.co`;
}

export async function POST(request: NextRequest) {
  const { nit, password } = await request.json();

  if (!nit?.trim() || !password) {
    return NextResponse.json({ error: 'Usuario y contraseña requeridos' }, { status: 400 });
  }

  const email = nitToEmail(nit);
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
  }

  const role = data.user.app_metadata?.role || 'proveedor';
  const redirect = role === 'admin' ? '/' : '/p/productos';

  return NextResponse.json({ ok: true, role, redirect });
}
