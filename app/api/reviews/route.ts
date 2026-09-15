import { isValidObjectId } from 'mongoose';
import { getViewer, requestThrottle, sameOrigin, throttle } from '@/lib/auth';
import { connectMongo } from '@/lib/mongodb';
import { Review, ServiceRequest } from '@/lib/models';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Invalid origin.' }, { status: 403 });
  try {
    const viewer = await getViewer();
    if (!viewer || viewer.isGuest || viewer.role !== 'CUSTOMER') return Response.json({ error: 'Please sign in as a customer.' }, { status: 403 });
    if (!(await throttle(`review:${viewer.id}`, 3)) || !(await requestThrottle(request, 'review', 10, viewer.id))) return Response.json({ error: 'Please wait before submitting another review.' }, { status: 429 });
    const body = await request.json().catch(() => ({}));
    if (!isValidObjectId(body.bookingId) || !Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5 || typeof body.text !== 'string' || !body.text.trim() || body.text.trim().length > 1500) return Response.json({ error: 'Choose a completed service, rating, and review (up to 1,500 characters).' }, { status: 400 });
    await connectMongo();
    const booking = await ServiceRequest.findOne({ _id: body.bookingId, customerId: viewer.id, status: 'COMPLETED' }).select('vehicleName serviceCategory');
    if (!booking) return Response.json({ error: 'Choose one of your completed services to leave a review.' }, { status: 403 });
    await Review.create({ customerId: viewer.id, bookingId: booking._id, name: viewer.displayName || 'Rider', vehicle: `${booking.vehicleName} · ${booking.serviceCategory}`.slice(0, 100), text: body.text.trim(), rating: body.rating, approved: false });
    return Response.json({ ok: true });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return Response.json({ error: 'You have already reviewed this completed service.' }, { status: 409 });
    return Response.json({ error: 'Unable to submit your review. Please try again.' }, { status: 503 });
  }
}
