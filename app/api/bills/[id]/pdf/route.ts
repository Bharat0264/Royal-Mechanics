import { isValidObjectId } from 'mongoose';
import { getViewer } from '@/lib/auth';
import { connectMongo } from '@/lib/mongodb';
import { Invoice } from '@/lib/models';
import { readInvoicePdf } from '@/lib/invoice-pdf';

export async function GET(_request: Request, context: RouteContext<'/api/bills/[id]/pdf'>) {
  const { id } = await context.params;
  const viewer = await getViewer();
  if (!viewer || !isValidObjectId(id)) return Response.json({ error: 'Bill not found.' }, { status: 404 });
  await connectMongo();
  const bill = await Invoice.findById(id).select('customerId invoiceNumber pdfUrl').lean();
  if (!bill || (viewer.role !== 'ADMIN' && String(bill.customerId) !== viewer.id))
    return Response.json({ error: 'Bill not found.' }, { status: 404 });
  if (!bill.pdfUrl) return Response.json({ error: 'Invoice PDF is not available yet.' }, { status: 404 });
  const file = await readInvoicePdf(bill.pdfUrl);
  if (!file) return Response.json({ error: 'Invoice PDF could not be read.' }, { status: 404 });
  return new Response(file.stream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${bill.invoiceNumber}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
