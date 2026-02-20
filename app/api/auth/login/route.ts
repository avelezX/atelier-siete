import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

function getAuthToken(password: string): string {
  return createHash('sha256').update(`atelier-${password}`).digest('hex').substring(0, 32);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: 'Clave requerida' }, { status: 400 });
    }

    const appPassword = process.env.APP_PASSWORD;
    if (!appPassword) {
      return NextResponse.json({ error: 'APP_PASSWORD no configurado en el servidor' }, { status: 500 });
    }

    if (password !== appPassword) {
      return NextResponse.json({ error: 'Clave incorrecta' }, { status: 401 });
    }

    // Generate auth token and set cookie
    const token = getAuthToken(appPassword);
    const response = NextResponse.json({ ok: true });

    response.cookies.set('atelier-auth', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Error procesando la solicitud' }, { status: 500 });
  }
}
