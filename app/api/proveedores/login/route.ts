import { NextRequest, NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

function makeToken(id: string, nit: string): string {
  const payload = Buffer.from(JSON.stringify({ id, nit })).toString('base64');
  // Simple signature using a fixed secret
  let hash = 0;
  const secret = process.env.APP_PASSWORD || 'atelier7';
  const str = payload + secret;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `${payload}.${Math.abs(hash).toString(36)}`;
}

export async function POST(request: NextRequest) {
  const { nit, password } = await request.json();

  if (!nit || !password) {
    return NextResponse.json({ error: 'NIT y contraseña requeridos' }, { status: 400 });
  }

  const { data, error } = await atelierTableAdmin('proveedores')
    .select('id, nit, nombre, tipo, activo')
    .eq('nit', nit.trim())
    .eq('password', password)
    .eq('activo', true)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'NIT o contraseña incorrectos' }, { status: 401 });
  }

  const token = makeToken(data.id, data.nit);

  const response = NextResponse.json({ ok: true, proveedor: { id: data.id, nombre: data.nombre, tipo: data.tipo } });
  response.cookies.set('p-auth', token, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 días
    sameSite: 'lax',
  });
  return response;
}
