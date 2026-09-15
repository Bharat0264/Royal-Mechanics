import 'server-only';
import type { InvoicePdfData } from './invoice-pdf';

const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);

export async function sendInvoiceEmail({
  to, invoice, pdf, paid,
}: { to: string; invoice: InvoicePdfData; pdf: Buffer; paid: boolean }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!apiKey || !from || !appUrl) throw new Error('Email delivery is not configured.');
  const total = invoice.total.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
  const status = paid ? 'Payment received' : 'Your Royal Mechanics bill is ready';
  const html = `<main style="margin:0 auto;padding:32px 20px;max-width:560px;background:#fcfaf6;color:#2a2723;font-family:Arial,sans-serif"><div style="border-bottom:2px solid #c58a28;padding-bottom:18px"><strong style="font-family:Georgia,serif;font-size:23px;letter-spacing:.04em">ROYAL MECHANICS</strong><p style="margin:7px 0 0;color:#8b6a33;font-size:12px">TWO-WHEELER SERVICE &amp; REPAIR</p></div><h1 style="font-family:Georgia,serif;font-weight:400">${status}</h1><p>Hello ${escape(invoice.customerName)},</p><p>Your bill for <strong>${escape(invoice.vehicleName)}</strong> is ${paid ? 'paid and your final receipt is attached.' : 'ready to review.'}</p><div style="padding:16px;background:#f2eadc;border-left:3px solid #c58a28"><strong>${escape(invoice.invoiceNumber)}</strong><br/>Total ${total}</div>${paid ? '' : `<p style="text-align:center;margin:28px 0"><a href="${appUrl}/garage" style="display:inline-block;padding:13px 22px;border-radius:6px;background:#c58a28;color:#fff;text-decoration:none;font-weight:700">Pay Now</a></p>`}<p style="font-size:12px;color:#6d665d">A PDF ${paid ? 'receipt' : 'invoice'} is attached for your records.</p></main>`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from, to: [to], subject: `${paid ? 'Payment received' : 'Invoice'} · ${invoice.invoiceNumber}`,
      html,
      attachments: [{ filename: `${invoice.invoiceNumber}${paid ? '-receipt' : ''}.pdf`, content: pdf.toString('base64') }],
    }),
  });
  if (!response.ok) throw new Error('Invoice email could not be delivered.');
}
