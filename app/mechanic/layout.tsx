import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { roleHomePath } from '@/lib/role-redirect';
import { MechanicSignout } from '../components/mechanic-portal';

export default async function MechanicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer();
  if (!viewer || viewer.isGuest || viewer.role !== 'MECHANIC')
    redirect(roleHomePath(viewer?.role));

  return (
    <div className="mechanic-console">
      <header className="mechanic-topbar">
        <Link className="mechanic-brand" href="/mechanic">
          <Image
            src="/royal-mechanics-logo-alpha.png"
            alt="Royal Mechanics"
            width={38}
            height={38}
            unoptimized
            sizes="38px"
            priority
          />
          <span>
            ROYAL MECHANICS <small>WORKSHOP</small>
          </span>
        </Link>
        <div className="mechanic-account">
          <span>{viewer.displayName}</span>
          <MechanicSignout />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
