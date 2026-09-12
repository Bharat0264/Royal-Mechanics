import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { AdminPortal } from '@/app/components/admin-portal';
import { roleHomePath } from '@/lib/role-redirect';
export async function AdminSection({ section }: { section: string }) {
  const viewer = await getViewer();
  if (!viewer) redirect(roleHomePath());
  if (viewer.role !== 'ADMIN' || viewer.isGuest)
    redirect(roleHomePath(viewer.role));
  return <AdminPortal viewer={viewer} section={section} />;
}
