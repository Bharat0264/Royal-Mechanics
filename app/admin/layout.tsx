import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import '../components/internal-portals.css';
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if ((await getViewer())?.role !== 'ADMIN') redirect('/');
  return <div className="internal-admin">{children}</div>;
}
