import { getViewer } from '@/lib/auth';
import { roleHomePath } from '@/lib/role-redirect';
import { redirect } from 'next/navigation';
import { HomePage } from '@/app/components/public-site';

export default async function Page() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  if (viewer && !viewer.isGuest && viewer.role !== 'CUSTOMER')
    redirect(roleHomePath(viewer.role));
  return <HomePage />;
}
