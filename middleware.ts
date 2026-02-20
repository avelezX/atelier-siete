import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

// Routes that don't require authentication
const PUBLIC_PATHS = ['/login', '/api/auth/login'];
const STATIC_PREFIXES = ['/_next/', '/favicon.ico'];

function getAuthToken(password: string): string {
  return createHash('sha256').update(`atelier-${password}`).digest('hex').substring(0, 32);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets and public paths
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // Check auth cookie
  const cookie = request.cookies.get('atelier-auth');
  const password = process.env.APP_PASSWORD;

  if (!password) {
    // No password configured — allow access (development without protection)
    return NextResponse.next();
  }

  const expectedToken = getAuthToken(password);

  if (cookie?.value === expectedToken) {
    return NextResponse.next();
  }

  // Not authenticated — redirect to login (for pages) or return 401 (for APIs)
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
