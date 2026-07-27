import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = new Set(['/login', '/setup']);
const PUBLIC_PREFIXES = ['/_next/', '/icons/', '/api/auth/'];
const MONITOR_PATHS = new Set([
  '/api/wechat/realtime-append',
  '/api/wechat/bulk-import',
  '/api/wechat/refresh-names',
  '/api/wechat/batch-analyze',
  '/api/wechat/auto-organize',
  '/api/wechat/manual-sync',
  '/api/wechat/blocklist',
  '/api/wechat/cleanup-test',
]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets and public paths
  if (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some(p => pathname.startsWith(p)) ||
    pathname.match(/\.(ico|png|jpg|svg|webp|json|txt)$/)
  ) {
    return NextResponse.next();
  }

  // Monitor API endpoints authenticate via X-Api-Key header
  if (MONITOR_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get('crm_session')?.value;
  if (!token || !token.includes('.')) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
