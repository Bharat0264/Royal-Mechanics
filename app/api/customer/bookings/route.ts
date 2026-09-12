import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/auth';
import { ServiceRequest } from '@/lib/models';

/** Customer-scoped live source for the service-progress tracker. */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer || viewer.isGuest || viewer.role !== 'CUSTOMER')
    return NextResponse.json(
      { error: 'Customer access required.' },
      { status: 403 },
    );

  const bookings = await ServiceRequest.find({ customerId: viewer.id })
    .sort({ createdAt: -1 })
    .lean();
  return NextResponse.json({ bookings: JSON.parse(JSON.stringify(bookings)) });
}
