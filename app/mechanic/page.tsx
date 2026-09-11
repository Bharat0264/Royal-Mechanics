import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { ServiceRequest } from '@/lib/models';
import { MechanicQueue } from '../components/mechanic-portal';
export const metadata = {
  title: 'Mechanic console | Royal Mechanics',
  robots: { index: false },
};
export default async function MechanicPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/sign-in');
  if (viewer.role !== 'MECHANIC')
    redirect(viewer.role === 'ADMIN' ? '/admin' : '/dashboard');
  if (viewer.mustChangePassword) redirect('/mechanic/set-password');
  const bookings = await ServiceRequest.find({ mechanicId: viewer.id })
    .populate('customerId', 'displayName')
    .sort({ updatedAt: -1 })
    .lean();
  return (
    <MechanicQueue
      jobs={JSON.parse(
        JSON.stringify(
          bookings.map((job) => ({
            ...job,
            intakePhotos: job.intakePhotos || [],
            faults: job.faults || [],
          })),
        ),
      )}
    />
  );
}
