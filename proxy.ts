import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { roleHomePath, type AppRole } from '@/lib/role-redirect';

const isPath = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

// This is an optimistic redirect. The database-backed route layouts are the
// authoritative enforcement point; this hint is never used to grant access.
export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const role = request.cookies.get('royal_mechanics_role')?.value;
  const appRole = ['ADMIN', 'MECHANIC', 'CUSTOMER'].includes(role || '')
    ? (role as AppRole)
    : undefined;
  const destination = roleHomePath(appRole);

  // Cookie hints make the redirect immediate. The route layouts re-check the
  // database session before rendering, so a forged or expired hint grants nothing.
  if (isPath(pathname, '/admin') && appRole !== 'ADMIN')
    return NextResponse.redirect(new URL('/', request.url));
  if (isPath(pathname, '/mechanic') && appRole !== 'MECHANIC')
    return NextResponse.redirect(new URL(destination, request.url));
  if (isPath(pathname, '/dashboard') || isPath(pathname, '/home'))
    return NextResponse.redirect(new URL(destination, request.url));
  if (pathname === '/login' && appRole)
    return NextResponse.redirect(new URL(destination, request.url));
  return NextResponse.next();
}

export const config = { matcher: ['/((?!api|_next|favicon.svg).*)'] };
