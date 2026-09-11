import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const customerPaths = new Set([
  '/', '/services', '/workshop', '/reviews', '/contact', '/book-service',
  '/dashboard', '/sign-in', '/reset-password', '/privacy', '/terms',
]);

// This is an optimistic redirect. The database-backed route layouts are the
// authoritative enforcement point; this hint is never used to grant access.
export function proxy(request: NextRequest) {
  if (!customerPaths.has(request.nextUrl.pathname)) return NextResponse.next();
  const role = request.cookies.get('royal_mechanics_role')?.value;
  if (role === 'ADMIN') return NextResponse.redirect(new URL('/admin', request.url));
  if (role === 'MECHANIC') return NextResponse.redirect(new URL('/mechanic', request.url));
  return NextResponse.next();
}

export const config = { matcher: ['/((?!api|_next|favicon.svg).*)'] };
