import { getViewer, sameOrigin, throttle } from '@/lib/auth';
import { Review } from '@/lib/models';
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: 'Invalid origin.' }, { status: 403 });
  try {
    const viewer = await getViewer();
    if (!viewer || viewer.role !== 'CUSTOMER')
      return Response.json(
        { error: 'Please sign in as a customer.' },
        { status: 403 },
      );
    if (!(await throttle(`review:${viewer.id}`, 3)))
      return Response.json(
        { error: 'Please wait before submitting another review.' },
        { status: 429 },
      );
    const body = await request.json();
    if (
      !Number.isInteger(body.rating) ||
      body.rating < 1 ||
      body.rating > 5 ||
      typeof body.text !== 'string' ||
      !body.text.trim() ||
      body.text.length > 1500
    )
      return Response.json(
        { error: 'Please add a rating and review (up to 1,500 characters).' },
        { status: 400 },
      );
    await Review.create({
      customerId: viewer.id,
      name: viewer.displayName || 'Rider',
      vehicle:
        typeof body.vehicle === 'string' ? body.vehicle.slice(0, 100) : '',
      text: body.text.trim(),
      rating: body.rating,
      approved: false,
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: 'Unable to submit your review. Please try again.' },
      { status: 503 },
    );
  }
}
