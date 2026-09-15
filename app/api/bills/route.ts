import { NextResponse } from 'next/server';
import { isValidObjectId } from 'mongoose';
import { getViewer, sameOrigin, requestThrottle } from '@/lib/auth';
import { connectMongo } from '@/lib/mongodb';
import { Invoice, ServiceRequest, SiteContent } from '@/lib/models';
import { defaultSettings } from '@/lib/site-defaults';
import { createInvoicePdf, storeInvoicePdf, type InvoicePdfData } from '@/lib/invoice-pdf';
import { sendInvoiceEmail } from '@/lib/invoice-email';

const reply = (body: unknown, status = 200) => NextResponse.json(body, { status });
const money = (value: unknown) => Math.round(Number(value || 0) * 100) / 100;
type FeeMode = 'FLAT' | 'PERCENTAGE';
type Fee = { mode: FeeMode; value: number; absorbed: boolean };
type Settings = typeof defaultSettings;
type PopulatedBooking = {
  _id: { toString(): string };
  requestNumber: string;
  vehicleName: string;
  mechanicId?: { displayName?: string };
  customerId: { _id: unknown; displayName?: string; email?: string };
};
const stringValue = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;

const normalizedFee = (source: unknown): Fee => {
  const value = source as Partial<Fee> | undefined;
  return {
    mode: value?.mode === 'PERCENTAGE' ? 'PERCENTAGE' : 'FLAT',
    value: Math.min(100_000, Math.max(0, Number(value?.value || 0))),
    absorbed: value?.absorbed !== false,
  };
};
const calculateFee = (amount: number, setting: Fee) =>
  money(setting.mode === 'PERCENTAGE' ? (amount * setting.value) / 100 : setting.value);

async function businessSettings(): Promise<Settings> {
  const saved = (await SiteContent.findOne({ key: 'settings' }).lean()) as { value?: Partial<Settings> } | null;
  const value = saved?.value;
  return {
    ...defaultSettings,
    ...value,
    fees: {
      ...defaultSettings.fees,
      ...value?.fees,
      platform: normalizedFee(value?.fees?.platform),
      gateway: normalizedFee(value?.fees?.gateway),
      taxRate: Math.min(28, Math.max(0, Number(value?.fees?.taxRate || 0))),
    },
  };
}

function invoiceData(bill: Record<string, unknown>, booking: PopulatedBooking | null, settings: Settings): InvoicePdfData {
  return {
    invoiceNumber: String(bill.invoiceNumber),
    bookingNumber: booking?.requestNumber,
    createdAt: bill.createdAt as Date,
    customerName: stringValue(bill.customerName, 'Royal Mechanics customer'),
    vehicleName: stringValue(bill.vehicleName, booking?.vehicleName || ''),
    mechanicName: booking?.mechanicId?.displayName || 'Royal Mechanics workshop',
    workshopAddress: settings.address,
    workshopPhone: settings.phone,
    workshopEmail: settings.email,
    workshopGstin: settings.gstin,
    subtotal: Number(bill.subtotal || 0),
    tax: Number(bill.tax || 0),
    taxRate: Number(bill.taxRate || 0),
    total: Number(bill.total || 0),
    items: (bill.items as InvoicePdfData['items']) || [],
    feeSnapshot: bill.feeSnapshot as InvoicePdfData['feeSnapshot'],
    paymentStatus: bill.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID',
    paymentMethod: bill.paymentMethod as string | undefined,
    razorpayPaymentId: bill.razorpayPaymentId as string | undefined,
  };
}

async function createAndStorePdf(bill: Record<string, unknown>, booking: PopulatedBooking | null, settings: Settings, receipt = false) {
  const pdf = await createInvoicePdf(invoiceData(bill, booking, settings));
  const pdfUrl = await storeInvoicePdf(String(bill.invoiceNumber), pdf, receipt);
  return { pdf, pdfUrl };
}

async function emailInvoice(bill: Record<string, unknown>, booking: PopulatedBooking | null, settings: Settings, pdf: Buffer, paid: boolean) {
  const email = booking?.customerId?.email;
  if (!email || email.endsWith('@royal-mechanics.local')) return false;
  await sendInvoiceEmail({ to: email, invoice: invoiceData(bill, booking, settings), pdf, paid });
  return true;
}

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return reply({ error: 'Sign in required.' }, 401);
  await connectMongo();
  const bills = await Invoice.find(viewer.role === 'ADMIN' ? {} : { customerId: viewer.id }).sort({ createdAt: -1 }).lean();
  return reply(JSON.parse(JSON.stringify({ bills })));
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: 'Invalid request origin.' }, 403);
  const viewer = await getViewer();
  if (viewer?.role !== 'ADMIN' || viewer.isGuest)
    return reply({ error: viewer?.isGuest ? 'Sign in to make changes.' : 'Admin access required.' }, 403);
  if (!(await requestThrottle(request, 'billing', 30, viewer.id))) return reply({ error: 'Too many requests. Please try again later.' }, 429);
  const body = await request.json().catch(() => ({}));
  const id = ['collect', 'send', 'email'].includes(body.action) ? body.invoiceId : body.bookingId;
  if (!isValidObjectId(id)) return reply({ error: 'Invalid record ID.' }, 400);
  await connectMongo();

  if (['collect', 'send', 'email'].includes(body.action)) {
    const bill = await Invoice.findById(body.invoiceId);
    if (!bill) return reply({ error: 'Bill not found.' }, 404);
    const booking = bill.bookingId
      ? (await ServiceRequest.findById(bill.bookingId).populate(['customerId', 'mechanicId']).lean()) as PopulatedBooking | null
      : null;
    const settings = await businessSettings();
    if (body.action === 'collect') {
      if (bill.paymentStatus === 'PAID') return reply({ error: 'This bill is already paid.' }, 400);
      const method = ['CASH', 'UPI', 'CARD'].includes(body.paymentMethod) ? body.paymentMethod : 'CASH';
      bill.paymentStatus = 'PAID'; bill.paymentMethod = method; bill.paymentConfirmedAt = new Date();
      const data = bill.toObject() as Record<string, unknown>;
      const { pdf, pdfUrl } = await createAndStorePdf({ ...data, paymentStatus: 'PAID', paymentMethod: method }, booking, settings, true);
      bill.pdfUrl = pdfUrl; bill.pdfGeneratedAt = new Date();
      try {
        if (await emailInvoice({ ...data, paymentStatus: 'PAID', paymentMethod: method }, booking, settings, pdf, true)) bill.receiptEmailedAt = new Date();
      } catch { /* The secure PDF stays available when email is temporarily unavailable. */ }
      await bill.save();
      if (bill.bookingId) await ServiceRequest.findByIdAndUpdate(bill.bookingId, { status: 'COMPLETED', completedAt: new Date() });
      return reply({ ok: true, message: `${method} payment collected. A paid receipt is available in the customer portal.` });
    }
    if (body.action === 'send') {
      if (bill.paymentStatus !== 'PAID') return reply({ error: 'A bill bundle can be sent after payment.' }, 400);
      bill.deliveredAt = new Date(); await bill.save();
      await ServiceRequest.findByIdAndUpdate(bill.bookingId, { sentAt: new Date() });
      return reply({ ok: true, message: 'The paid PDF receipt and job evidence are now available together in the customer portal.' });
    }
    const data = bill.toObject() as Record<string, unknown>;
    const { pdf } = await createAndStorePdf(data, booking, settings, bill.paymentStatus === 'PAID');
    try {
      await emailInvoice(data, booking, settings, pdf, bill.paymentStatus === 'PAID');
      if (bill.paymentStatus === 'PAID') bill.receiptEmailedAt = new Date(); else bill.invoiceEmailedAt = new Date();
      await bill.save();
      return reply({ ok: true, message: 'Bill email sent to the customer.' });
    } catch {
      return reply({ error: 'The PDF is ready, but email delivery is not configured or failed.' }, 503);
    }
  }

  const booking = (await ServiceRequest.findById(body.bookingId).populate(['customerId', 'mechanicId']).lean()) as PopulatedBooking | null;
  if (!booking) return reply({ error: 'Booking not found.' }, 404);
  if (await Invoice.exists({ bookingId: booking._id })) return reply({ error: 'This booking already has a bill.' }, 409);
  const items = Array.isArray(body.items) && body.items.length <= 50
    ? body.items.map((item: { name?: string; quantity?: number; unitPrice?: number }) => {
        const quantity = Math.min(1_000, Math.max(1, Number(item.quantity || 1)));
        const unitPrice = money(item.unitPrice);
        return { name: String(item.name || '').trim().slice(0, 120), quantity, unitPrice, amount: money(quantity * unitPrice) };
      }).filter((item: { name: string; unitPrice: number }) => item.name && Number.isFinite(item.unitPrice) && item.unitPrice >= 0 && item.unitPrice <= 10_000_000)
    : [];
  if (!items.length) return reply({ error: 'Add at least one bill item.' }, 400);
  const settings = await businessSettings();
  const subtotal = money(items.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0));
  const platform = normalizedFee(settings.fees.platform); const platformAmount = calculateFee(subtotal, platform);
  const passedPlatform = platform.absorbed ? 0 : platformAmount;
  const gateway = normalizedFee(settings.fees.gateway); const gatewayAmount = calculateFee(subtotal + passedPlatform, gateway);
  const passedGateway = gateway.absorbed ? 0 : gatewayAmount;
  const taxRate = Math.min(28, Math.max(0, Number(body.taxRate ?? settings.fees.taxRate ?? 0)));
  const tax = money((subtotal + passedPlatform + passedGateway) * taxRate / 100);
  const total = money(subtotal + passedPlatform + passedGateway + tax);
  const customer = booking.customerId;
  const draft = {
    invoiceNumber: `RM-${Date.now().toString().slice(-8)}`,
    createdBy: viewer.id, customerId: customer._id, bookingId: booking._id,
    customerName: customer.displayName || 'Royal Mechanics customer', vehicleName: booking.vehicleName,
    items, subtotal, total, tax, taxRate, platformFee: platformAmount, paymentHandlingFee: gatewayAmount, payableTotal: total,
    feeSnapshot: { platform: { ...platform, amount: platformAmount }, gateway: { ...gateway, amount: gatewayAmount } },
    paymentStatus: 'UNPAID' as const, createdAt: new Date(),
  };
  try {
    const { pdf, pdfUrl } = await createAndStorePdf(draft, booking, settings);
    const bill = await Invoice.create({ ...draft, pdfUrl, pdfGeneratedAt: new Date() });
    let emailSent = false;
    try {
      emailSent = await emailInvoice(bill.toObject() as Record<string, unknown>, booking, settings, pdf, false);
      if (emailSent) { bill.invoiceEmailedAt = new Date(); await bill.save(); }
    } catch { /* A missing mail provider does not make the generated PDF inaccessible. */ }
    return reply({ ok: true, bill: JSON.parse(JSON.stringify(bill)), emailSent }, 201);
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : 'Bill PDF could not be generated.' }, 503);
  }
}
