import { redirect, notFound } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { AdminPortal } from '@/app/components/admin-portal';
export const metadata = {
  title: 'Command centre | Royal Mechanics',
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const viewer = await getViewer();
  if (viewer?.role !== 'ADMIN') redirect('/');
  const { section } = await params;
  const active = section?.[0] || 'overview';
  if (
    (section?.length || 0) > 1 ||
    ![
      'overview',
      'bookings',
      'customers',
      'staff',
      'services',
      'reviews',
      'workshop',
      'settings',
    ].includes(active)
  )
    notFound();
  return <AdminPortal key={active} viewer={viewer} section={active} />;
}
