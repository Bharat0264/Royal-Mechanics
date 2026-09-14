import { isValidObjectId } from 'mongoose';
import { Invoice } from '@/lib/models';
import { connectMongo } from '@/lib/mongodb';
import { getViewer, requestThrottle, sameOrigin } from '@/lib/auth';

const reply = (body: unknown, status = 200) => Response.json(body, { status });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: 'Invalid request origin.' }, 403);
  const viewer = await getViewer();
  if (!viewer || viewer.role === 'ADMIN' || viewer.isGuest)
    return reply({ error: 'Customer access required.' }, 403);
  if (!(await requestThrottle(request, 'payment-order', 10, viewer.id)))
    return reply({ error: 'Too many payment attempts. Please try again later.' }, 429);
  const { invoiceId } = await request.json().catch(() => ({}));
  if (!isValidObjectId(invoiceId)) return reply({ error: 'Invalid bill ID.' }, 400);
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return reply({ error: 'Razorpay is not configured.' }, 503);
  await connectMongo();
  const invoice = await Invoice.findOne({ _id: invoiceId, customerId: viewer.id });
  if (!invoice) return reply({ error: 'Bill not found.' }, 404);
  if (invoice.paymentStatus === 'PAID') return reply({ error: 'This bill is already paid.' }, 400);
  const amount = Math.round((invoice.payableTotal || invoice.total) * 100);
  if (!Number.isSafeInteger(amount) || amount < 100 || amount > 100_000_000)
    return reply({ error: 'This bill amount cannot be paid online.' }, 400);
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ amount, currency: 'INR', receipt: invoice.invoiceNumber, notes: { invoiceNumber: invoice.invoiceNumber } }),
  });
  const order = await response.json().catch(() => ({}));
  if (!response.ok)
    return reply({ error: order?.error?.description ?? 'Razorpay could not create the order.' }, 502);
  if (typeof order.id !== 'string' || !Number.isSafeInteger(order.amount))
    return reply({ error: 'Razorpay returned an invalid order.' }, 502);
  invoice.payableTotal = amount / 100;
  invoice.razorpayOrderId = order.id;
  await invoice.save();
  return reply({ keyId, orderId: order.id, amount: order.amount, currency: 'INR', invoiceNumber: invoice.invoiceNumber, customerName: invoice.customerName });
}
