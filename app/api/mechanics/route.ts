import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getViewer, hashPassword, requestThrottle, sameOrigin } from '@/lib/auth';
import { connectMongo } from '@/lib/mongodb';
import { User } from '@/lib/models';
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status });
const temporaryPassword = () => {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%^&*_-+='];
  const chars = sets.map((set) => set[randomBytes(1)[0] % set.length]);
  while (chars.length < 14) { const set = sets[randomBytes(1)[0] % sets.length]; chars.push(set[randomBytes(1)[0] % set.length]); }
  return chars.sort(() => randomBytes(1)[0] / 255 - 0.5).join('');
};
export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: 'Invalid request origin.' }, 403);
  const viewer = await getViewer();
  if (viewer?.role !== 'ADMIN' || viewer.isGuest) return reply({ error: 'Admin access required.' }, 403);
  if (!(await requestThrottle(request, 'mechanic-create', 10, viewer.id)))
    return reply({ error: 'Too many requests. Please try again later.' }, 429);
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 30) : '';
  const specialty = typeof body.specialty === 'string' ? body.specialty.trim().slice(0, 500) : '';
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !phone || !specialty) return reply({ error: 'Name, email, phone and specialty are required.' }, 400);
  await connectMongo();
  if (await User.exists({ email })) return reply({ error: 'That email already has an account.' }, 409);
  const generatedPassword = temporaryPassword();
  const user = await User.create({ displayName: name, email, phone, specialties: specialty, role: 'MECHANIC', passwordHash: await hashPassword(generatedPassword), mustChangePassword: true });
  const canSendInvitation = Boolean(
    process.env.RESEND_API_KEY && process.env.EMAIL_FROM && process.env.APP_URL,
  );
  let invitationDelivered = false;
  if (canSendInvitation) {
    try {
    const portalLink = new URL('/login', process.env.APP_URL).toString();
    const sent = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [email], subject: 'Your Royal Mechanics mechanic portal credentials', text: `Welcome to Royal Mechanics.\n\nMechanic Portal: ${portalLink}\nLogin email: ${email}\nTemporary password: ${generatedPassword}\n\nFor your security, you will be required to set a new password at first sign-in.` }) });
    invitationDelivered = sent.ok;
    } catch {
      invitationDelivered = false;
    }
  }
  return reply({
    ok: true,
    userId: String(user._id),
    invitationDelivered,
    ...(invitationDelivered ? {} : { temporaryPassword: generatedPassword, email }),
  });
}
