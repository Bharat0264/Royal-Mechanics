import { NextResponse } from 'next/server';
import {
  hashPassword,
  hashSession,
  issueSession,
  issueGuestSession,
  sameOrigin,
  throttle,
  requestThrottle,
  validPassword,
  verifyPassword,
} from '@/lib/auth';
import { PasswordReset, Session, User } from '@/lib/models';
import { randomBytes } from 'node:crypto';
const error = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  if (!sameOrigin(request)) return error('Request origin is not allowed.', 403);
  const { action } = await params;
  if (
    !['login', 'signup', 'forgot-password', 'reset-password', 'guest'].includes(action)
  )
    return error('Not found.', 404);
  const body = await request.json().catch(() => ({}));
  if (action === 'guest') return issueGuestSession(request);
  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (
    action !== 'reset-password' &&
    (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254)
  )
    return error('Enter a valid email address.');
  try {
    if (
      !(await throttle(
        `${action}:${action === 'reset-password' ? String(body.token).slice(0, 64) : email}`,
        action === 'forgot-password' ? 3 : 10,
      ))
    )
      return error('Too many attempts. Please try again in 15 minutes.', 429);
    if (!(await requestThrottle(request, `auth:${action}`, action === 'forgot-password' ? 5 : 20)))
      return error('Too many attempts. Please try again in 15 minutes.', 429);
    if (action === 'signup') {
      if (
        typeof body.name !== 'string' ||
        body.name.trim().length < 2 ||
        body.name.length > 100
      )
        return error('Enter your full name.');
      if (
        typeof body.phone !== 'string' ||
        !/^\+?[\d\s()-]{10,20}$/.test(body.phone)
      )
        return error('Enter a valid phone number.');
      if (!validPassword(body.password))
        return error(
          'Use 10–128 characters with letters and a number or symbol.',
        );
      if (body.terms !== true)
        return error('Please accept the Terms & Privacy policy.');
      if (await User.exists({ email }))
        return error('Email already registered. Please sign in.', 409);
      const user = await User.create({
        email,
        displayName: body.name.trim(),
        phone: body.phone.trim(),
        passwordHash: await hashPassword(body.password),
        role: 'CUSTOMER',
        termsAcceptedAt: new Date(),
      });
      return issueSession(user, request, false);
    }
    if (action === 'login') {
      if (typeof body.password !== 'string' || body.password.length > 128)
        return error('Invalid email or password.', 401);
      const user = await User.findOne({ email }).select('+passwordHash');
      const dummy = '00000000000000000000000000000000:' + '00'.repeat(64);
      const valid = await verifyPassword(
        body.password,
        user?.passwordHash || dummy,
      );
      if (!user || !valid || !user.isAllowed)
        return error('Invalid email or password.', 401);
      return issueSession(user, request, body.remember === true);
    }
    if (action === 'forgot-password') {
      if (
        !process.env.RESEND_API_KEY ||
        !process.env.EMAIL_FROM ||
        !process.env.APP_URL
      )
        return error(
          'Password reset email is temporarily unavailable. Please contact the workshop.',
          503,
        );
      const user = await User.findOne({ email, isAllowed: true });
      if (user) {
        const raw = randomBytes(32).toString('hex');
        const reset = await PasswordReset.create({
          userId: user._id,
          tokenHash: await hashSession(raw),
          expiresAt: new Date(Date.now() + 1800000),
        });
        const link = new URL('/reset-password', process.env.APP_URL);
        link.searchParams.set('token', raw);
        const sent = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM,
            to: [email],
            subject: 'Reset your Royal Mechanics password',
            text: `Reset your password using this link (valid for 30 minutes): ${link}\n\nIf you did not request this, you can ignore this email.`,
          }),
        });
        if (!sent.ok) {
          await PasswordReset.deleteOne({ _id: reset._id });
          return error('Email could not be sent. Please try again later.', 503);
        }
      }
      return NextResponse.json({ ok: true });
    }
    if (!validPassword(body.password))
      return error(
        'Use 10–128 characters with letters and a number or symbol.',
      );
    if (typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token))
      return error('This reset link is invalid or expired. Request a new one.');
    const hash = await hashPassword(body.password);
    const reset = await PasswordReset.findOneAndDelete({
      tokenHash: await hashSession(body.token),
      expiresAt: { $gt: new Date() },
    });
    if (!reset)
      return error('This reset link is invalid or expired. Request a new one.');
    await User.updateOne(
      { _id: reset.userId },
      { $set: { passwordHash: hash } },
    );
    await Promise.all([
      Session.deleteMany({ userId: reset.userId }),
      PasswordReset.deleteMany({ userId: reset.userId }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { code?: number }).code === 11000)
      return error('Email already registered. Please sign in.', 409);
    return error(
      'Account service is unavailable. Please try again shortly.',
      503,
    );
  }
}
