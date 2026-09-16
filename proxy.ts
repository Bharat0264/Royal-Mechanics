import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { roleHomePath, type AppRole } from '@/lib/role-redirect';

const isPath = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

// This is an optimistic redirect. The database-backed route layouts are the
// authoritative enforcement point; this hint is never used to grant access.
export function proxy(request: NextRequest) {
  if (
    process.env.NODE_ENV === 'production' &&
    request.headers.get('x-forwarded-proto') !== 'https'
  ) {
    const url = request.nextUrl.clone();
    url.protocol = 'https:';
    return NextResponse.redirect(url, 308);
  }
  const pathname = request.nextUrl.pathname;
  const role = request.cookies.get('royal_mechanics_role')?.value;
  const appRole = ['ADMIN', 'MECHANIC', 'CUSTOMER'].includes(role || '')
    ? (role as AppRole)
    : undefined;
  const destination = roleHomePath(appRole);

  // Cookie hints make the redirect immediate. The route layouts re-check the
  // database session before rendering, so a forged or expired hint grants nothing.
  // An absent hint must not be treated as a customer. It can be stale or be
  // unavailable on a freshly restored session; letting the protected layout
  // resolve the database-backed session avoids bouncing through the public
  // homepage before the portal is rendered.
  if (isPath(pathname, '/admin') && appRole && appRole !== 'ADMIN')
    return NextResponse.redirect(new URL('/', request.url));
  if (isPath(pathname, '/mechanic') && appRole && appRole !== 'MECHANIC')
    return NextResponse.redirect(new URL(destination, request.url));
  if (isPath(pathname, '/dashboard') || isPath(pathname, '/home'))
    return NextResponse.redirect(new URL(destination, request.url));
  if (pathname === '/login' && appRole)
    return NextResponse.redirect(new URL(destination, request.url));

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-inline'" : ''}`,
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.razorpay.com",
    'frame-src https://www.google.com https://checkout.razorpay.com',
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = { matcher: ['/((?!_next|favicon.svg).*)'] };
