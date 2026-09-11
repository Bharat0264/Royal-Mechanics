import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { ServiceRequest } from '@/lib/models';
import { CustomerDashboard } from '../components/customer-dashboard';
export const metadata = { title: 'Mechanic console | Royal Mechanics', robots: { index: false } };
export default async function MechanicPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/sign-in');
  if (viewer.role !== 'MECHANIC') redirect(viewer.role === 'ADMIN' ? '/admin' : '/dashboard');
  const bookings = await ServiceRequest.find({ mechanicId: viewer.id }).sort({ updatedAt: -1 }).lean();
  return <CustomerDashboard viewer={viewer} bookings={JSON.parse(JSON.stringify(bookings))} invoices={[]} />;
}
