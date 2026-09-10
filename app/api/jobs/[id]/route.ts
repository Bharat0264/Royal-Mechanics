import { NextResponse } from 'next/server';
import { getViewer, sameOrigin } from '@/lib/auth';
import { connectMongo } from '@/lib/mongodb';
import { ServiceRequest } from '@/lib/models';

const reply = (body: unknown, status = 200) => NextResponse.json(body, { status });
const image = (value: unknown) => typeof value === 'string' && /^https?:\/\//i.test(value.trim()) ? value.trim() : '';

export async function PATCH(request: Request, context: RouteContext<'/api/jobs/[id]'>) {
  if (!sameOrigin(request)) return reply({ error: 'Invalid request origin.' }, 403);
  const viewer = await getViewer();
  if (!viewer || !['ADMIN', 'MECHANIC'].includes(viewer.role)) return reply({ error: 'Mechanic or admin access required.' }, 403);
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  await connectMongo();
  const booking = await ServiceRequest.findById(id);
  if (!booking) return reply({ error: 'Job not found.' }, 404);
  if (viewer.role === 'MECHANIC' && String(booking.mechanicId) !== viewer.id) return reply({ error: 'This job is not assigned to you.' }, 403);
  if (body.action === 'intake') {
    const photos = Array.isArray(body.photos) ? body.photos.map(image).filter(Boolean) : [];
    if (photos.length !== 4) return reply({ error: 'Attach exactly four intake photos: front, back, left and right.' }, 400);
    booking.intakePhotos = photos; booking.status = 'IN_PROGRESS';
  } else if (body.action === 'faults') {
    const faults = Array.isArray(body.faults) ? body.faults.map((text: unknown) => String(text).trim()).filter(Boolean).slice(0, 30) : [];
    if (!faults.length) return reply({ error: 'Add at least one fault.' }, 400);
    booking.faults = faults.map((text: string) => ({ text, beforePhoto: '', afterPhoto: '', completed: false }));
  } else if (body.action === 'fault') {
    const index = Number(body.index);
    if (!Number.isInteger(index) || !booking.faults[index]) return reply({ error: 'Fault not found.' }, 404);
    const fault = booking.faults[index];
    if (body.beforePhoto !== undefined) fault.beforePhoto = image(body.beforePhoto);
    if (body.afterPhoto !== undefined) fault.afterPhoto = image(body.afterPhoto);
    if (body.completed) {
      if (!fault.beforePhoto || !fault.afterPhoto) return reply({ error: 'Attach both before and after photos before completing a fault.' }, 400);
      fault.completed = true;
    }
  } else if (body.action === 'ready') {
    if (booking.intakePhotos.length !== 4 || !booking.faults.length || booking.faults.some((fault: { completed: boolean; beforePhoto: string; afterPhoto: string }) => !fault.completed || !fault.beforePhoto || !fault.afterPhoto)) return reply({ error: 'Complete all intake and fault evidence before marking the vehicle ready.' }, 400);
    booking.status = 'QUALITY_CHECK'; booking.readyAt = new Date();
  } else return reply({ error: 'Unknown job action.' }, 400);
  await booking.save();
  return reply({ ok: true, booking: JSON.parse(JSON.stringify(booking)) });
}
