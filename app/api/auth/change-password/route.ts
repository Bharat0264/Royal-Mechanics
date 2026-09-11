import { NextResponse } from 'next/server';
import { getViewer, hashPassword, sameOrigin, validPassword } from '@/lib/auth';
import { connectMongo } from '@/lib/mongodb';
import { User } from '@/lib/models';

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const viewer = await getViewer();
  if (!viewer || viewer.role !== 'MECHANIC')
    return NextResponse.json({ error: 'Mechanic access required.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (!validPassword(body.password))
    return NextResponse.json(
      { error: 'Use 10–128 characters with letters and a number or symbol.' },
      { status: 400 },
    );
  await connectMongo();
  await User.updateOne(
    { _id: viewer.id, role: 'MECHANIC' },
    { $set: { passwordHash: await hashPassword(body.password), mustChangePassword: false } },
  );
  return NextResponse.json({ ok: true, redirect: '/mechanic' });
}
