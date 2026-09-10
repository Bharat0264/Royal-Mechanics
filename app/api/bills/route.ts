import { NextResponse } from 'next/server';
import { getViewer, sameOrigin } from '@/lib/auth';
import { connectMongo } from '@/lib/mongodb';
import { Invoice, ServiceRequest } from '@/lib/models';

const reply = (body: unknown, status = 200) => NextResponse.json(body, { status });
const money = (value: unknown) => Math.round(Number(value || 0) * 100) / 100;

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return reply({ error: 'Sign in required.' }, 401);
  await connectMongo();
  const query = viewer.role === 'ADMIN' ? {} : { customerId: viewer.id };
  const bills = await Invoice.find(query).sort({ createdAt: -1 }).lean();
  return reply(JSON.parse(JSON.stringify({ bills })));
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: 'Invalid request origin.' }, 403);
  const viewer = await getViewer();
  if (viewer?.role !== 'ADMIN') return reply({ error: 'Admin access required.' }, 403);
  const body = await request.json().catch(() => ({}));
  await connectMongo();
  if (body.action === 'collect') {
    const bill = await Invoice.findById(body.invoiceId);
    if (!bill) return reply({ error: 'Bill not found.' }, 404);
    if (bill.paymentStatus === 'PAID') return reply({ error: 'This bill is already paid.' }, 400);
    const method = ['CASH', 'UPI', 'CARD'].includes(body.paymentMethod) ? body.paymentMethod : 'CASH';
    bill.paymentStatus = 'PAID'; bill.paymentMethod = method; bill.paymentConfirmedAt = new Date();
    await bill.save();
    if (bill.bookingId) await ServiceRequest.findByIdAndUpdate(bill.bookingId, { status: 'COMPLETED' });
    return reply({ ok: true, message: `${method === 'CASH' ? 'Cash' : method} payment collected. The paid bill is now in the customer portal.` });
  }
  if (body.action === 'send') {
    const bill = await Invoice.findById(body.invoiceId);
    if (!bill) return reply({ error: 'Bill not found.' }, 404);
    if (bill.paymentStatus !== 'PAID') return reply({ error: 'A bill can be sent after payment.' }, 400);
    bill.deliveredAt = new Date();
    await bill.save();
    await ServiceRequest.findByIdAndUpdate(bill.bookingId, { sentAt: new Date() });
    return reply({ ok: true, message: 'Bill and job evidence are now available together in the customer portal.' });
  }
  const booking = await ServiceRequest.findById(body.bookingId).populate('customerId', 'displayName email');
  if (!booking) return reply({ error: 'Booking not found.' }, 404);
  if (await Invoice.exists({ bookingId: booking._id })) return reply({ error: 'This booking already has a bill.' }, 409);
  const items = Array.isArray(body.items) ? body.items.map((item: { name?: string; quantity?: number; unitPrice?: number }) => {
    const quantity = Math.max(1, Number(item.quantity || 1));
    const unitPrice = money(item.unitPrice);
    return { name: String(item.name || '').trim(), quantity, unitPrice, amount: money(quantity * unitPrice) };
  }).filter((item: { name: string }) => item.name) : [];
  if (!items.length) return reply({ error: 'Add at least one bill item.' }, 400);
  const subtotal = money(items.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0));
  const taxRate = Math.min(28, Math.max(0, Number(body.taxRate || 0)));
  const tax = money(subtotal * taxRate / 100);
  const total = money(subtotal + tax);
  const customer = booking.customerId as unknown as { _id: unknown; displayName?: string };
  const bill = await Invoice.create({
    invoiceNumber: `RM-${Date.now().toString().slice(-8)}`,
    createdBy: viewer.id,
    customerId: customer._id,
    bookingId: booking._id,
    customerName: customer.displayName || 'Royal Mechanics customer',
    vehicleName: booking.vehicleName,
    items, total, tax, taxRate, payableTotal: total,
  });
  return reply({ ok: true, bill: JSON.parse(JSON.stringify(bill)) }, 201);
}
