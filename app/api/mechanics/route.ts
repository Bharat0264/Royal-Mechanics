import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getViewer, hashPassword, sameOrigin } from '@/lib/auth';
import { connectMongo } from '@/lib/mongodb';
import { User } from '@/lib/models';
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status });
const admin = async () => (await getViewer())?.role === 'ADMIN';
const temporaryPassword = () => {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%^&*_-+='];
  const chars = sets.map((set) => set[randomBytes(1)[0] % set.length]);
  while (chars.length < 14) { const set = sets[randomBytes(1)[0] % sets.length]; chars.push(set[randomBytes(1)[0] % set.length]); }
  return chars.sort(() => randomBytes(1)[0] / 255 - 0.5).join('');
};
export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: 'Invalid request origin.' }, 403);
  if (!(await admin())) return reply({ error: 'Admin access required.' }, 403);
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 30) : '';
  const specialty = typeof body.specialty === 'string' ? body.specialty.trim().slice(0, 500) : '';
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !phone || !specialty) return reply({ error: 'Name, email, phone and specialty are required.' }, 400);
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM || !process.env.APP_URL) return reply({ error: 'Mechanic email delivery is not configured.' }, 503);
  await connectMongo();
  if (await User.exists({ email })) return reply({ error: 'That email already has an account.' }, 409);
  const generatedPassword = temporaryPassword();
  const user = await User.create({ displayName: name, email, phone, specialties: specialty, role: 'MECHANIC', passwordHash: await hashPassword(generatedPassword), mustChangePassword: true });
  try {
    const portalLink = new URL('/mechanic/login', process.env.APP_URL).toString();
    const sent = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [email], subject: 'Your Royal Mechanics mechanic portal credentials', text: `Welcome to Royal Mechanics.\n\nMechanic Portal: ${portalLink}\nLogin email: ${email}\nTemporary password: ${generatedPassword}\n\nFor your security, you will be required to set a new password at first sign-in.` }) });
    if (!sent.ok) throw new Error('delivery failed');
  } catch { await User.deleteOne({ _id: user._id }); return reply({ error: 'The account was not created because the invitation email could not be sent.' }, 503); }
  return reply({ ok: true });
}
