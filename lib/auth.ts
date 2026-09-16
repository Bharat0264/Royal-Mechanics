import { cookies } from 'next/headers';
import { cache } from 'react';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import { AuthThrottle, Session, User } from '@/lib/models';
import { roleHomePath } from '@/lib/role-redirect';

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim().toLowerCase();
export const SESSION_COOKIE = 'royal_mechanics_session';
export const GUEST_COOKIE = 'royal_mechanics_guest';
export type Viewer = {
  id: string;
  email: string;
  displayName: string | null;
  role: 'ADMIN' | 'MECHANIC' | 'CUSTOMER';
  mustChangePassword: boolean;
  isGuest: boolean;
};
const derive = promisify(scrypt);
export async function hashSession(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Buffer.from(digest).toString('hex');
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await derive(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: string, hash: string) {
  const [salt, stored] = hash.split(':');
  if (!salt || !stored) return false;
  const key = (await derive(password, salt, 64)) as Buffer;
  const expected = Buffer.from(stored, 'hex');
  return expected.length === key.length && timingSafeEqual(expected, key);
}
export function validPassword(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 10 &&
    value.length <= 128 &&
    /[a-zA-Z]/.test(value) &&
    /[^a-zA-Z]/.test(value)
  );
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin) return origin === new URL(request.url).origin;
  // Browsers attach Origin to JSON mutations. Permit the rare same-site
  // navigation request without weakening cross-site CSRF protection.
  const fetchSite = request.headers.get('sec-fetch-site');
  return fetchSite === 'same-origin' || fetchSite === 'same-site';
}
export function clientAddress(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
export async function requestThrottle(
  request: Request,
  namespace: string,
  max: number,
  identity = '',
) {
  return throttle(`${namespace}:${clientAddress(request)}:${identity}`, max);
}
export async function throttle(key: string, max = 10) {
  await connectMongo();
  const window = Math.floor(Date.now() / 900000);
  const record = await AuthThrottle.findOneAndUpdate(
    { key: await hashSession(`${key}:${window}`) },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date(Date.now() + 900000) },
    },
    { upsert: true, new: true },
  );
  return record.count <= max;
}
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) {
    if (jar.get(GUEST_COOKIE)?.value === '1')
      return {
        id: 'guest',
        email: '',
        displayName: 'Guest',
        role: 'CUSTOMER',
        mustChangePassword: false,
        isGuest: true,
      };
    return null;
  }
  await connectMongo();
  const session = await Session.findOne({
    tokenHash: await hashSession(token),
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!session) return null;
  const user = await User.findById(session.userId).lean();
  if (!user || !user.isAllowed) return null;
  return {
    id: String(user._id),
    email: user.email,
    displayName: user.displayName ?? null,
    role: user.role,
    mustChangePassword: user.mustChangePassword === true,
    isGuest: false,
  };
});
export async function issueSession(
  user: { _id: unknown; role: string; mustChangePassword?: boolean },
  request: Request,
  remember = false,
  response?: NextResponse,
) {
  const raw = randomBytes(32).toString('hex');
  // Persist across browser restarts: 7 days normally, 30 days when requested.
  const maxAge = (remember ? 30 : 7) * 86400;
  const expiresAt = new Date(Date.now() + maxAge * 1000);
  await Session.create({
    tokenHash: await hashSession(raw),
    userId: user._id,
    expiresAt,
  });
  const result =
    response ??
    NextResponse.json({
      ok: true,
      redirect: roleHomePath(user.role as Viewer['role']),
    });
  result.cookies.set(SESSION_COOKIE, raw, {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === 'production' ||
      new URL(request.url).protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge,
    expires: expiresAt,
  });
  result.cookies.set('royal_mechanics_role', String(user.role), {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === 'production' ||
      new URL(request.url).protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge,
    expires: expiresAt,
  });
  result.cookies.set(GUEST_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return result;
}

/** A browser-session-only viewer. It deliberately creates no User or Session record. */
export function issueGuestSession(request: Request) {
  const result = NextResponse.json({ ok: true, redirect: '/' });
  const secure =
    process.env.NODE_ENV === 'production' ||
    new URL(request.url).protocol === 'https:';
  result.cookies.set(GUEST_COOKIE, '1', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
  });
  result.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  result.cookies.set('royal_mechanics_role', 'GUEST', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
  });
  return result;
}
