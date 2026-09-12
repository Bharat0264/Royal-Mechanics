import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getViewer, hashPassword, sameOrigin } from '@/lib/auth';
import { connectMongo } from '@/lib/mongodb';
import { User } from '@/lib/models';

const temporaryPassword = () => {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%^&*_-+='];
  const chars = sets.map((set) => set[randomBytes(1)[0] % set.length]);
  while (chars.length < 14) {
    const set = sets[randomBytes(1)[0] % sets.length];
    chars.push(set[randomBytes(1)[0] % set.length]);
  }
  return chars.sort(() => randomBytes(1)[0] / 255 - 0.5).join('');
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const viewer = await getViewer();
  if (viewer?.role !== 'ADMIN' || viewer.isGuest) return NextResponse.json({ error: viewer?.isGuest ? 'Sign in to make changes.' : 'Admin access required.' }, { status: 403 });
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM || !process.env.APP_URL) return NextResponse.json({ error: 'Email delivery is not configured.' }, { status: 503 });
  const { id } = await params;
  await connectMongo();
  const mechanic = await User.findOne({ _id: id, role: 'MECHANIC' });
  if (!mechanic) return NextResponse.json({ error: 'Mechanic account not found.' }, { status: 404 });
  const password = temporaryPassword();
  const portalLink = new URL('/login', process.env.APP_URL).toString();
  const sent = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [mechanic.email], subject: 'Your Royal Mechanics mechanic portal credentials', text: `Mechanic Portal: ${portalLink}\nLogin email: ${mechanic.email}\nTemporary password: ${password}\n\nSet a new password at first sign-in.` }),
  });
  if (!sent.ok) return NextResponse.json({ error: 'Resend could not deliver the invitation. Verify EMAIL_FROM and your sending domain.' }, { status: 503 });
  mechanic.passwordHash = await hashPassword(password);
  mechanic.mustChangePassword = true;
  await mechanic.save();
  return NextResponse.json({ ok: true });
}
