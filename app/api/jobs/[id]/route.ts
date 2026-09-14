import { NextResponse } from 'next/server';
import { getViewer, requestThrottle, sameOrigin } from '@/lib/auth';
import { connectMongo } from '@/lib/mongodb';
import { ServiceRequest } from '@/lib/models';
import { isValidObjectId } from 'mongoose';

const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status });
const image = (value: unknown) => {
  if (typeof value !== 'string') return '';
  const source = value.trim();
  if (/^https:\/\//i.test(source) && source.length <= 2_048) return source;
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(source);
  // Data URLs are the current capture transport, not arbitrary file uploads.
  // Restrict their MIME type and decoded size to one megabyte per evidence image.
  if (!match || match[2].length > 1_398_104) return '';
  return source;
};

export async function PATCH(
  request: Request,
  context: RouteContext<'/api/jobs/[id]'>,
) {
  if (!sameOrigin(request))
    return reply({ error: 'Invalid request origin.' }, 403);
  const viewer = await getViewer();
  if (!viewer || viewer.isGuest || !['ADMIN', 'MECHANIC'].includes(viewer.role))
    return reply({ error: 'Mechanic or admin access required.' }, 403);
  if (!(await requestThrottle(request, 'job-update', 40, viewer.id)))
    return reply({ error: 'Too many requests. Please try again later.' }, 429);
  const { id } = await context.params;
  if (!isValidObjectId(id)) return reply({ error: 'Invalid job ID.' }, 400);
  const body = await request.json().catch(() => ({}));
  await connectMongo();
  const booking = await ServiceRequest.findById(id);
  if (!booking) return reply({ error: 'Job not found.' }, 404);
  if (viewer.role === 'MECHANIC' && String(booking.mechanicId) !== viewer.id)
    return reply({ error: 'This job is not assigned to you.' }, 403);
  if (['COMPLETED', 'CANCELLED', 'QUALITY_CHECK'].includes(booking.status))
    return reply({ error: 'This job is closed for mechanic changes.' }, 409);
  if (body.action !== 'intake' && booking.intakePhotos.length !== 4)
    return reply({ error: 'Save all four intake photos first.' }, 400);
  if (body.action === 'intake') {
    const photos = Array.isArray(body.photos)
      ? body.photos.map(image).filter(Boolean)
      : [];
    if (photos.length !== 4)
      return reply(
        {
          error:
            'Attach exactly four intake photos: front, back, left and right.',
        },
        400,
      );
    booking.intakePhotos = photos;
    booking.status = 'IN_PROGRESS';
  } else if (body.action === 'addFault') {
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text || text.length > 300 || booking.faults.length >= 30)
      return reply(
        { error: 'Enter one fault, up to 300 characters (30 faults maximum).' },
        400,
      );
    booking.faults.push({
      text,
      beforePhoto: '',
      afterPhoto: '',
      completed: false,
    });
  } else if (body.action === 'faults') {
    if (booking.faults.length)
      return reply(
        { error: 'Add faults individually to preserve existing evidence.' },
        409,
      );
    const faults = Array.isArray(body.faults)
      ? body.faults
          .map((text: unknown) => String(text).trim())
          .filter(Boolean)
          .slice(0, 30)
      : [];
    if (!faults.length) return reply({ error: 'Add at least one fault.' }, 400);
    booking.faults = faults.map((text: string) => ({
      text,
      beforePhoto: '',
      afterPhoto: '',
      completed: false,
    }));
  } else if (body.action === 'fault') {
    const index = Number(body.index);
    if (!Number.isInteger(index) || !booking.faults[index])
      return reply({ error: 'Fault not found.' }, 404);
    const fault = booking.faults[index];
    if (body.beforePhoto !== undefined)
      fault.beforePhoto = image(body.beforePhoto);
    if (body.afterPhoto !== undefined)
      fault.afterPhoto = image(body.afterPhoto);
    if (body.completed) {
      if (!fault.beforePhoto || !fault.afterPhoto)
        return reply(
          {
            error:
              'Attach both before and after photos before completing a fault.',
          },
          400,
        );
      fault.completed = true;
    }
    if (body.completed === false || !fault.beforePhoto || !fault.afterPhoto)
      fault.completed = false;
  } else if (body.action === 'ready') {
    if (
      booking.intakePhotos.length !== 4 ||
      !booking.faults.length ||
      booking.faults.some(
        (fault: {
          completed: boolean;
          beforePhoto: string;
          afterPhoto: string;
        }) => !fault.completed || !fault.beforePhoto || !fault.afterPhoto,
      )
    )
      return reply(
        {
          error:
            'Complete all intake and fault evidence before marking the vehicle ready.',
        },
        400,
      );
    booking.status = 'QUALITY_CHECK';
    booking.readyAt = new Date();
  } else return reply({ error: 'Unknown job action.' }, 400);
  await booking.save();
  return reply({ ok: true, booking: JSON.parse(JSON.stringify(booking)) });
}
