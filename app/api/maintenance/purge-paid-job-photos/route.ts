import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import { Invoice, ServiceRequest } from '@/lib/models';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  await connectMongo();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const paid = await Invoice.find({ paymentStatus: 'PAID', paymentConfirmedAt: { $lte: cutoff }, bookingId: { $exists: true } }).select('bookingId').lean();
  const bookingIds = paid.map((bill) => bill.bookingId);
  if (!bookingIds.length) return NextResponse.json({ ok: true, deleted: 0 });
  const result = await ServiceRequest.updateMany(
    { _id: { $in: bookingIds }, $or: [{ intakePhotos: { $ne: [] } }, { faults: { $ne: [] } }, { inspectionPhotos: { $ne: [] } }] },
    { $set: { intakePhotos: [], inspectionPhotos: [], faults: [] } },
  );
  return NextResponse.json({ ok: true, deleted: result.modifiedCount });
}
