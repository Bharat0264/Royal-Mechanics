import { cookies } from 'next/headers';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import { AuthThrottle, Session, User } from '@/lib/models';

export const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || 'bharathsaipulipati@gmail.com';
export const SESSION_COOKIE = 'royal_mechanics_session';
export type Viewer = {
  id: string;
  email: string;
  displayName: string | null;
  role: 'ADMIN' | 'MECHANIC' | 'CUSTOMER';
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
  return !origin || origin === new URL(request.url).origin;
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
export async function getViewer(): Promise<Viewer | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
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
  };
}
export async function issueSession(
  user: { _id: unknown; role: string },
  request: Request,
  remember = false,
  response?: NextResponse,
) {
  const raw = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + (remember ? 30 : 1) * 86400000);
  await Session.create({
    tokenHash: await hashSession(raw),
    userId: user._id,
    expiresAt,
  });
  const result =
    response ??
    NextResponse.json({
      ok: true,
      redirect: user.role === 'ADMIN' ? '/admin' : '/dashboard',
    });
  result.cookies.set(SESSION_COOKIE, raw, {
    httpOnly: true,
    secure: new URL(request.url).protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    ...(remember ? { expires: expiresAt } : {}),
  });
  return result;
}
