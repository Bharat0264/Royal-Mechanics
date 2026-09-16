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

  // Do not route a portal request using the role hint. It can be stale (for
  // example after an account role change), and redirecting it to `/` mounts
  // the public layout before the database-backed portal check redirects back.
  // The protected route's server components are the routing boundary for
  // `/admin` and `/mechanic`; their loading boundaries cover the session
  // lookup without exposing another route's UI.
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
