import { PublicHeader } from '@/app/components/public-header';
import { getViewer } from '@/lib/auth';
import { redirect } from 'next/navigation';
export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer();
  if (viewer?.role === 'ADMIN') redirect('/admin');
  if (viewer?.role === 'MECHANIC') redirect('/mechanic');
  return (
    <>
      <PublicHeader />
      {children}
    </>
  );
}
