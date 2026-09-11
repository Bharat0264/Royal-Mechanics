import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ADMIN_EMAIL, issueSession } from '@/lib/auth';
import { connectMongo } from '@/lib/mongodb';
import { User } from '@/lib/models';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const state = jar.get('rm_oauth_state')?.value;
  const fail = (
    reason: 'state' | 'denied' | 'token' | 'profile' | 'account' | 'server',
  ) => {
    console.error('[auth/google] callback failed', { reason });
    const result = NextResponse.redirect(
      new URL(`/sign-in?error=google-${reason}`, request.url),
    );
    result.cookies.set('rm_oauth_state', '', {
      path: '/api/auth/google',
      maxAge: 0,
    });
    return result;
  };
  if (url.searchParams.get('error')) return fail('denied');
  if (
    !state ||
    state !== url.searchParams.get('state') ||
    !url.searchParams.get('code')
  )
    return fail('state');
  try {
    const origin = url.origin;
    const exchange = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        code: url.searchParams.get('code')!,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    if (!exchange.ok) {
      const detail = await exchange.json().catch(() => ({}));
      console.error('[auth/google] token exchange rejected', {
        status: exchange.status,
        error: typeof detail.error === 'string' ? detail.error : 'unknown',
      });
      return fail('token');
    }
    const tokens = await exchange.json();
    const identity = await fetch(
      'https://openidconnect.googleapis.com/v1/userinfo',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );
    if (!identity.ok) return fail('profile');
    const profile = await identity.json();
    if (!profile.email_verified || !profile.sub || !profile.email)
      return fail('profile');
    await connectMongo();
    const email = profile.email.toLowerCase();
    let user = await User.findOne({ email });
    if (!user)
      user = await User.create({
        email,
        googleSubject: profile.sub,
        displayName: profile.name,
        role: email === ADMIN_EMAIL ? 'ADMIN' : 'CUSTOMER',
      });
    else {
      if (!user.isAllowed) return fail('account');
      if (user.googleSubject && user.googleSubject !== profile.sub)
        return fail('account');
      user.googleSubject = profile.sub;
      if (email === ADMIN_EMAIL) user.role = 'ADMIN';
      await user.save();
    }
    const result = NextResponse.redirect(
      new URL(
        user.role === 'ADMIN'
          ? '/admin'
          : user.role === 'MECHANIC'
            ? user.mustChangePassword
              ? '/mechanic/set-password'
              : '/mechanic'
            : '/dashboard',
        request.url,
      ),
    );
    result.cookies.set('rm_oauth_state', '', {
      path: '/api/auth/google',
      maxAge: 0,
    });
    return issueSession(user, request, false, result);
  } catch (error) {
    console.error('[auth/google] callback server failure', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return fail('server');
  }
}
