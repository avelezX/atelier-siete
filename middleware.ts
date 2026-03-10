import { NextRequest, NextResponse } from 'next/server';

// Routes that don't require authentication
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/siigo/balance-prueba', '/api/dashboard/comparar-balance', '/api/siigo/test-endpoints'];
const STATIC_PREFIXES = ['/_next/', '/favicon.ico'];

// Simple hash function compatible with Edge Runtime (no Node.js crypto)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return 'at7_' + Math.abs(hash).toString(36);
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

  const expectedToken = simpleHash(`atelier-${password}`);

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
