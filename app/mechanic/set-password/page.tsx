import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { MechanicSetPassword } from '@/app/components/mechanic-portal';
import { roleHomePath } from '@/lib/role-redirect';

export const metadata = { title: 'Set password | Royal Mechanics', robots: { index: false } };

export default async function SetMechanicPasswordPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.isGuest || viewer.role !== 'MECHANIC')
    redirect(roleHomePath(viewer?.role));
  if (!viewer.mustChangePassword) redirect('/mechanic');
  return <MechanicSetPassword />;
}
