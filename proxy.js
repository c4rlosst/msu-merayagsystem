import { NextResponse } from 'next/server';

export function proxy(request) {
  if (request.nextUrl.pathname.startsWith('/clinic') && !request.cookies.has('__Host-merayag')) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  const nonce = btoa(crypto.randomUUID());
  const development = process.env.NODE_ENV === 'development';
  const csp = [
    "default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'",
    "img-src 'self' data: https://*.googleusercontent.com", "font-src 'self'", "connect-src 'self'" + (development ? ' ws: wss:' : ''),
    "form-action 'self'", "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'nonce-" + nonce + "'" + (development ? " 'unsafe-eval'" : '')
  ].join('; ');
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };

