import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
export async function GET(request: Request) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
    return NextResponse.redirect(
      new URL('/login?error=google-unavailable', request.url),
    );
  const state = randomBytes(32).toString('hex');
  const origin = new URL(request.url).origin;
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  }).toString();
  const result = NextResponse.redirect(url);
  result.cookies.set('rm_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: new URL(request.url).protocol === 'https:',
    path: '/api/auth/google',
    maxAge: 600,
  });
  return result;
}
