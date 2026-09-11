import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { Invoice, ServiceRequest } from '@/lib/models';
import { CustomerDashboard } from '../components/customer-dashboard';
export const metadata = {
  title: 'Your garage | Royal Mechanics',
  robots: { index: false },
};
export default async function Page() {
  const viewer = await getViewer();
  if (!viewer) redirect('/sign-in');
  if (viewer.role === 'ADMIN') redirect('/admin');
  if (viewer.role === 'MECHANIC') redirect('/mechanic');
  const bookings = await ServiceRequest.find(
    { customerId: viewer.id },
  )
    .sort({ createdAt: -1 })
    .lean();
  const invoices = await Invoice.find({ customerId: viewer.id }).sort({ createdAt: -1 }).lean();
  return (
    <CustomerDashboard
      viewer={viewer}
      bookings={JSON.parse(JSON.stringify(bookings))}
      invoices={JSON.parse(JSON.stringify(invoices))}
    />
  );
}
