import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/auth';
import { connectMongo } from '@/lib/mongodb';
import { ServiceRequest, User } from '@/lib/models';

const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status });

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.isGuest)
    return reply({ error: 'Please sign in before confirming a booking.' }, 401);
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const vehicleName =
    typeof body?.vehicleName === 'string' ? body.vehicleName.trim() : '';
  const vehicleNumber =
    typeof body?.vehicleNumber === 'string'
      ? body.vehicleNumber.trim().toUpperCase()
      : '';
  const serviceCategory =
    typeof body?.serviceCategory === 'string'
      ? body.serviceCategory.trim()
      : '';
  const serviceMode =
    body?.serviceMode === 'PICKUP_DROP'
      ? 'PICKUP_DROP'
      : body?.serviceMode === 'SELF_DROP'
        ? 'SELF_DROP'
        : '';
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
  if (!vehicleName || !vehicleNumber || !serviceCategory || !serviceMode)
    return reply(
      { error: 'Vehicle, vehicle number, service category, and service mode are required.' },
      400,
    );
  if (!/^\+?[\d\s()-]{10,20}$/.test(phone))
    return reply(
      { error: 'Enter a valid contact number so we can confirm your booking.' },
      400,
    );
  const pickup = body?.pickupLocation as Record<string, unknown> | undefined;
  const latitude =
    typeof pickup?.latitude === 'number' ? pickup.latitude : undefined;
  const longitude =
    typeof pickup?.longitude === 'number' ? pickup.longitude : undefined;
  const address = pickup?.address as Record<string, unknown> | undefined;
  const hasAddress = Boolean(
    address &&
    Object.values(address).some(
      (value) => typeof value === 'string' && value.trim(),
    ),
  );
  if (
    serviceMode === 'PICKUP_DROP' &&
    latitude === undefined &&
    longitude === undefined &&
    !hasAddress
  )
    return reply({ error: 'Pickup location or address is required.' }, 400);
  await connectMongo();
  await User.updateOne({ _id: viewer.id }, { $set: { phone } });
  const created = await ServiceRequest.create({
    requestNumber: `RM-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
    customerId: viewer.id,
    vehicleName,
    vehicleNumber,
    serviceCategory,
    serviceMode,
    notes:
      typeof body?.notes === 'string' ? body.notes.trim().slice(0, 1500) : '',
    preferredSlot:
      typeof body?.preferredSlot === 'string'
        ? body.preferredSlot.trim().slice(0, 120)
        : '',
    pickupLocation: pickup
      ? {
          latitude,
          longitude,
          accuracy:
            typeof pickup.accuracy === 'number' ? pickup.accuracy : undefined,
          capturedAt:
            typeof pickup.capturedAt === 'string'
              ? new Date(pickup.capturedAt)
              : undefined,
          address,
        }
      : {},
  });
  return reply(
    {
      request: {
        id: String(created._id),
        requestNumber: created.requestNumber,
        status: created.status,
      },
    },
    201,
  );
}

export async function GET() {
  const viewer = await getViewer();
  if (!viewer || !['ADMIN', 'MECHANIC'].includes(viewer.role))
    return reply({ error: 'Workshop access required.' }, 403);
  await connectMongo();
  // Assignment and access are scoped to the immutable account ID, never a
  // display name (or a shared-looking email label).
  const query = viewer.role === 'ADMIN' ? {} : { mechanicId: viewer.id };
  const requests = await ServiceRequest.find(query)
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return reply({
    requests: requests.map((item) => ({
      id: String(item._id),
      requestNumber: item.requestNumber,
      vehicleName: item.vehicleName,
      vehicleNumber: item.vehicleNumber,
      serviceCategory: item.serviceCategory,
      serviceMode: item.serviceMode,
      status: item.status,
      preferredSlot: item.preferredSlot,
      mechanicEmail: item.mechanicEmail ?? null,
      notes: item.notes,
      createdAt: item.createdAt,
      pickupLocation: item.pickupLocation,
    })),
  });
}
