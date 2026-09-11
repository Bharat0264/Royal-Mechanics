import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import '../components/internal-portals.css';
import { MechanicSignout } from '../components/mechanic-portal';
export default async function MechanicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer();
  if (viewer?.role !== 'MECHANIC') redirect('/');
  return (
    <div className="mechanic-console">
      <header>
        <Link href="/mechanic">♛ ROYAL MECHANICS / WORKSHOP</Link>
        <span>{viewer.displayName}</span>
        <MechanicSignout />
      </header>
      <main>{children}</main>
    </div>
  );
}
