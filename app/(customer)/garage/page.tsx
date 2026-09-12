import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { roleHomePath } from '@/lib/role-redirect';
import { Invoice, ServiceRequest } from '@/lib/models';
import { CustomerDashboard } from '@/app/components/customer-dashboard';

export const metadata = {
  title: 'My garage | Royal Mechanics',
  robots: { index: false },
};

/** Customer-owned vehicles and their service history. */
export default async function GaragePage() {
  const viewer = await getViewer();
  if (!viewer || viewer.isGuest || viewer.role !== 'CUSTOMER')
    redirect(roleHomePath(viewer?.role));
  const [bookings, invoices] = await Promise.all([
    ServiceRequest.find({ customerId: viewer.id }).sort({ createdAt: -1 }).lean(),
    Invoice.find({ customerId: viewer.id }).sort({ createdAt: -1 }).lean(),
  ]);
  return (
    <CustomerDashboard
      viewer={viewer}
      bookings={JSON.parse(JSON.stringify(bookings))}
      invoices={JSON.parse(JSON.stringify(invoices))}
    />
  );
}
