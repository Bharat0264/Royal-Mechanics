import { createHmac, timingSafeEqual } from 'node:crypto';
import { isValidObjectId } from 'mongoose';
import { Invoice, ServiceRequest } from '@/lib/models';
import { connectMongo } from '@/lib/mongodb';
import { getViewer, requestThrottle, sameOrigin } from '@/lib/auth';

const reply = (body: unknown, status = 200) => Response.json(body, { status });
const razorpayId = (value: unknown) =>
  typeof value === 'string' && /^pay_[A-Za-z0-9]+$/.test(value) && value.length <= 100;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: 'Invalid request origin.' }, 403);
  const viewer = await getViewer();
  if (!viewer || viewer.role === 'ADMIN' || viewer.isGuest)
    return reply({ error: 'Customer access required.' }, 403);
  if (!(await requestThrottle(request, 'payment-verify', 10, viewer.id)))
    return reply({ error: 'Too many payment attempts. Please try again later.' }, 429);
  const { invoiceId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = await request.json().catch(() => ({}));
  if (!isValidObjectId(invoiceId) || !razorpayId(razorpay_payment_id) || typeof razorpay_order_id !== 'string' || !/^order_[A-Za-z0-9]+$/.test(razorpay_order_id) || typeof razorpay_signature !== 'string' || !/^[a-f0-9]{64}$/i.test(razorpay_signature))
    return reply({ error: 'Incomplete or invalid payment response.' }, 400);
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return reply({ error: 'Razorpay is not configured.' }, 503);
  await connectMongo();
  const invoice = await Invoice.findOne({ _id: invoiceId, customerId: viewer.id });
  if (!invoice || invoice.razorpayOrderId !== razorpay_order_id)
    return reply({ error: 'Invoice payment order mismatch.' }, 400);
  if (invoice.paymentStatus === 'PAID') return reply({ ok: true, invoiceNumber: invoice.invoiceNumber });
  const expected = createHmac('sha256', secret).update(`${invoice.razorpayOrderId}|${razorpay_payment_id}`).digest('hex');
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature)))
    return reply({ error: 'Payment signature verification failed.' }, 400);
  invoice.paymentStatus = 'PAID';
  invoice.razorpayPaymentId = razorpay_payment_id;
  invoice.paymentMethod = 'RAZORPAY';
  invoice.paymentConfirmedAt = new Date();
  await invoice.save();
  if (invoice.bookingId)
    await ServiceRequest.findByIdAndUpdate(invoice.bookingId, { status: 'COMPLETED', completedAt: new Date() });
  return reply({ ok: true, invoiceNumber: invoice.invoiceNumber });
}
