import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, hashSession, sameOrigin } from '@/lib/auth';
import { connectMongo } from '@/lib/mongodb';
import { Session } from '@/lib/models';
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await connectMongo();
      await Session.deleteOne({ tokenHash: await hashSession(token) });
    } catch {
      return NextResponse.json(
        { error: 'Unable to sign out. Please try again.' },
        { status: 503 },
      );
    }
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });
  return response;
}
