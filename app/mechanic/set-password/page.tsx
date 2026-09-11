import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { MechanicSetPassword } from '@/app/components/mechanic-portal';

export const metadata = { title: 'Set password | Royal Mechanics', robots: { index: false } };

export default async function SetMechanicPasswordPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/sign-in');
  if (viewer.role !== 'MECHANIC') redirect(viewer.role === 'ADMIN' ? '/admin' : '/dashboard');
  if (!viewer.mustChangePassword) redirect('/mechanic');
  return <MechanicSetPassword />;
}
