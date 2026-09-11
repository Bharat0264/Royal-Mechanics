import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { AdminPortal } from '@/app/components/admin-portal';
export async function AdminSection({ section }: { section: string }) {
  const viewer = await getViewer();
  if (viewer?.role !== 'ADMIN') redirect('/');
  return <AdminPortal viewer={viewer} section={section} />;
}
