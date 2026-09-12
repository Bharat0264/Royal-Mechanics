import { BookingPage } from '@/app/components/public-site';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { roleHomePath } from '@/lib/role-redirect';

export const metadata = { title: 'Book service | Royal Mechanics' };

export default async function Page() {
  const viewer = await getViewer();
  if (viewer && viewer.role !== 'CUSTOMER')
    redirect(roleHomePath(viewer.role));
  return <BookingPage />;
}
