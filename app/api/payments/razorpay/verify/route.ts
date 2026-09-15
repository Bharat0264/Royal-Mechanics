import { createHmac, timingSafeEqual } from 'node:crypto';
import { isValidObjectId } from 'mongoose';
import { Invoice, ServiceRequest, SiteContent } from '@/lib/models';
import { connectMongo } from '@/lib/mongodb';
import { getViewer, requestThrottle, sameOrigin } from '@/lib/auth';
import { defaultSettings } from '@/lib/site-defaults';
import { createInvoicePdf, storeInvoicePdf, type InvoicePdfData } from '@/lib/invoice-pdf';
import { sendInvoiceEmail } from '@/lib/invoice-email';

const reply = (body: unknown, status = 200) => Response.json(body, { status });
const razorpayId = (value: unknown) =>
  typeof value === 'string' && /^pay_[A-Za-z0-9]+$/.test(value) && value.length <= 100;

async function receiptData(invoice: Record<string, unknown>) {
  const [booking, settingsRecord] = await Promise.all([
    invoice.bookingId ? ServiceRequest.findById(invoice.bookingId).populate(['customerId', 'mechanicId']).lean() : null,
    SiteContent.findOne({ key: 'settings' }).lean(),
  ]);
  const stored = (settingsRecord as { value?: Partial<typeof defaultSettings> } | null)?.value || {};
  const settings = { ...defaultSettings, ...stored };
  const customer = booking?.customerId as { email?: string } | undefined;
  const mechanic = booking?.mechanicId as { displayName?: string } | undefined;
  const pdfData: InvoicePdfData = {
    invoiceNumber: String(invoice.invoiceNumber), bookingNumber: booking?.requestNumber,
    createdAt: invoice.createdAt as Date, customerName: typeof invoice.customerName === 'string' ? invoice.customerName : 'Royal Mechanics customer',
    vehicleName: String(invoice.vehicleName || booking?.vehicleName || ''), mechanicName: mechanic?.displayName || 'Royal Mechanics workshop',
    workshopAddress: settings.address, workshopPhone: settings.phone, workshopEmail: settings.email, workshopGstin: settings.gstin,
    subtotal: Number(invoice.subtotal || 0), tax: Number(invoice.tax || 0), taxRate: Number(invoice.taxRate || 0), total: Number(invoice.total || 0),
    items: (invoice.items as InvoicePdfData['items']) || [], feeSnapshot: invoice.feeSnapshot as InvoicePdfData['feeSnapshot'],
    paymentStatus: 'PAID', paymentMethod: 'RAZORPAY', razorpayPaymentId: invoice.razorpayPaymentId as string | undefined,
  };
  return { pdfData, customerEmail: customer?.email };
}

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
  try {
    const data = invoice.toObject() as Record<string, unknown>;
    const { pdfData, customerEmail } = await receiptData({ ...data, paymentStatus: 'PAID', paymentMethod: 'RAZORPAY', razorpayPaymentId: razorpay_payment_id });
    const pdf = await createInvoicePdf(pdfData);
    invoice.pdfUrl = await storeInvoicePdf(invoice.invoiceNumber, pdf, true);
    invoice.pdfGeneratedAt = new Date();
    if (customerEmail && !customerEmail.endsWith('@royal-mechanics.local')) {
      try { await sendInvoiceEmail({ to: customerEmail, invoice: pdfData, pdf, paid: true }); invoice.receiptEmailedAt = new Date(); } catch { /* Receipt remains available through the dashboard. */ }
    }
  } catch {
    // Payment is authoritative after Razorpay signature validation. A later admin
    // email action can retry delivery if PDF storage is temporarily unavailable.
  }
  await invoice.save();
  if (invoice.bookingId)
    await ServiceRequest.findByIdAndUpdate(invoice.bookingId, { status: 'COMPLETED', completedAt: new Date() });
  return reply({ ok: true, invoiceNumber: invoice.invoiceNumber });
}
