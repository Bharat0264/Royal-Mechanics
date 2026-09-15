import 'server-only';
import { get, put } from '@vercel/blob';
import PDFDocument from 'pdfkit';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

type InvoiceItem = { name: string; quantity: number; unitPrice: number; amount: number };
type FeeSnapshot = {
  platform?: { absorbed?: boolean; amount?: number };
  gateway?: { absorbed?: boolean; amount?: number };
};
export type InvoicePdfData = {
  invoiceNumber: string;
  bookingNumber?: string;
  createdAt: Date | string;
  customerName: string;
  vehicleName: string;
  mechanicName?: string;
  workshopAddress?: string;
  workshopPhone?: string;
  workshopEmail?: string;
  workshopGstin?: string;
  subtotal: number;
  tax: number;
  taxRate?: number;
  total: number;
  items: InvoiceItem[];
  feeSnapshot?: FeeSnapshot;
  paymentStatus: 'PAID' | 'UNPAID';
  paymentMethod?: string;
  razorpayPaymentId?: string;
};

const money = (value: number) => `Rs. ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const safe = (value: string | undefined) => value?.trim() || '—';

async function logo(): Promise<Buffer | null> {
  try {
    return await readFile(join(process.cwd(), 'public', 'royal-mechanics-logo-alpha.png'));
  } catch {
    return null;
  }
}

function line(doc: InstanceType<typeof PDFDocument>, y: number) {
  doc.strokeColor('#c58a28').lineWidth(0.8).moveTo(48, y).lineTo(547, y).stroke();
}

function label(doc: InstanceType<typeof PDFDocument>, title: string, value: string, x: number, y: number) {
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#8a795f').text(title.toUpperCase(), x, y);
  doc.font('Helvetica').fontSize(10).fillColor('#2a2723').text(value, x, y + 12, { width: 215 });
}

/** Creates a printable, server-side PDF rather than a browser screenshot. */
export async function createInvoicePdf(data: InvoicePdfData) {
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Invoice ${data.invoiceNumber}`, Author: 'Royal Mechanics' } });
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const crest = await logo();
  if (crest) doc.image(crest, 48, 42, { fit: [57, 57] });
  else {
    doc.circle(76, 70, 27).fillAndStroke('#241b12', '#c58a28');
    doc.fillColor('#e6ba69').font('Helvetica-Bold').fontSize(15).text('RM', 62, 64);
  }
  doc.fillColor('#211b16').font('Times-Bold').fontSize(23).text('ROYAL MECHANICS', 118, 48);
  doc.font('Helvetica').fontSize(9).fillColor('#625b51').text(safe(data.workshopAddress), 118, 76, { width: 265 });
  doc.text([data.workshopPhone, data.workshopEmail, data.workshopGstin ? `GSTIN ${data.workshopGstin}` : ''].filter(Boolean).join('  |  ') || 'Two-wheeler service & repair', 118, 89, { width: 310 });
  doc.font('Times-Bold').fontSize(21).fillColor('#211b16').text('INVOICE', 431, 52, { width: 116, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#9a6a1c').text(data.invoiceNumber, 431, 79, { width: 116, align: 'right' });
  line(doc, 115);

  const issued = new Date(data.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  label(doc, 'Bill ID', data.invoiceNumber, 48, 134);
  label(doc, 'Booking ID', safe(data.bookingNumber), 300, 134);
  label(doc, 'Date', issued, 48, 177);
  label(doc, 'Workshop / mechanic', safe(data.mechanicName), 300, 177);
  label(doc, 'Billed to', safe(data.customerName), 48, 220);
  label(doc, 'Vehicle', safe(data.vehicleName), 300, 220);

  let y = 281;
  doc.roundedRect(48, y, 499, 23, 2).fill('#2a241e');
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#f7ebd5');
  doc.text('DESCRIPTION', 58, y + 8).text('QTY', 338, y + 8, { width: 40, align: 'right' }).text('UNIT PRICE', 390, y + 8, { width: 70, align: 'right' }).text('TOTAL', 470, y + 8, { width: 66, align: 'right' });
  y += 23;
  data.items.forEach((item, index) => {
    const rowHeight = 27;
    if (index % 2 === 0) doc.rect(48, y, 499, rowHeight).fill('#faf6ef');
    doc.font('Helvetica').fontSize(9).fillColor('#312d28');
    doc.text(item.name, 58, y + 9, { width: 265 }).text(String(item.quantity), 338, y + 9, { width: 40, align: 'right' }).text(money(item.unitPrice), 390, y + 9, { width: 70, align: 'right' }).font('Helvetica-Bold').text(money(item.amount), 470, y + 9, { width: 66, align: 'right' });
    y += rowHeight;
  });
  y += 15;
  const platform = data.feeSnapshot?.platform;
  const gateway = data.feeSnapshot?.gateway;
  const totals: [string, number][] = [
    ['Subtotal', data.subtotal],
    ...(!platform?.absorbed && platform?.amount ? [['Platform fee', platform.amount] as [string, number]] : []),
    ...(!gateway?.absorbed && gateway?.amount ? [['Payment gateway fee', gateway.amount] as [string, number]] : []),
    ...(data.tax ? [[`Tax${data.taxRate ? ` (${data.taxRate}%)` : ''}`, data.tax] as [string, number]] : []),
  ];
  totals.forEach(([name, amount]) => {
    doc.font('Helvetica').fontSize(9).fillColor('#625b51').text(name, 360, y, { width: 98, align: 'right' }).fillColor('#2a2723').text(money(amount), 470, y, { width: 66, align: 'right' });
    y += 18;
  });
  line(doc, y + 2);
  doc.font('Times-Bold').fontSize(14).fillColor('#211b16').text('GRAND TOTAL', 340, y + 12, { width: 118, align: 'right' }).fillColor('#9a6a1c').text(money(data.total), 450, y + 12, { width: 86, align: 'right' });

  const footerY = Math.max(y + 58, 650);
  const paid = data.paymentStatus === 'PAID';
  doc.roundedRect(48, footerY, paid ? 66 : 83, 23, 3).fill(paid ? '#287348' : '#bd7a1f');
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#fff').text(paid ? 'PAID' : 'PENDING', 53, footerY + 7, { width: paid ? 56 : 73, align: 'center' });
  const paymentDetail = paid ? `${data.paymentMethod || 'Payment'}${data.razorpayPaymentId ? ` · ${data.razorpayPaymentId}` : ''}` : 'Payment is due via your Royal Mechanics dashboard.';
  doc.font('Helvetica').fontSize(8.5).fillColor('#625b51').text(paymentDetail, 143, footerY + 7, { width: 400 });
  doc.font('Helvetica').fontSize(8).fillColor('#827a70').text('Thank you for choosing Royal Mechanics. Parts and workmanship are covered by the warranty terms supplied with your service.', 48, footerY + 40, { width: 499, align: 'center' });
  doc.end();
  return finished;
}

export async function storeInvoicePdf(invoiceNumber: string, pdf: Buffer, receipt = false) {
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    throw new Error('Invoice storage is not configured. Add BLOB_READ_WRITE_TOKEN in Vercel.');
  const result = await put(`invoices/${invoiceNumber}${receipt ? '-receipt' : ''}.pdf`, pdf, {
    access: 'private',
    addRandomSuffix: false,
    contentType: 'application/pdf',
  });
  return result.url;
}

export async function readInvoicePdf(url: string) {
  const result = await get(url, { access: 'private' });
  if (!result || result.statusCode !== 200) return null;
  return result;
}
