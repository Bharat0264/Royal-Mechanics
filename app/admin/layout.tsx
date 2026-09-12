import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { roleHomePath } from '@/lib/role-redirect';
import '../components/internal-portals.css';
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer();
  if (!viewer || viewer.isGuest || viewer.role !== 'ADMIN')
    redirect(roleHomePath(viewer?.role));
  return <div className="internal-admin">{children}</div>;
}
