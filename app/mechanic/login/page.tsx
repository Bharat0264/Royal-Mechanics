import { redirect } from 'next/navigation';
import { AuthExperience } from '@/app/components/auth-experience';
import { getViewer } from '@/lib/auth';

export const metadata = {
  title: 'Mechanic Portal | Royal Mechanics',
  robots: { index: false },
};

export default async function MechanicLoginPage() {
  const viewer = await getViewer();
  if (viewer?.role === 'MECHANIC') {
    redirect(viewer.mustChangePassword ? '/mechanic/set-password' : '/mechanic');
  }
  if (viewer?.role === 'ADMIN') redirect('/admin');
  if (viewer?.role === 'CUSTOMER') redirect('/dashboard');
  return <AuthExperience portal="mechanic" />;
}
