import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { roleHomePath } from '@/lib/role-redirect';
import { MechanicSignout } from '../components/mechanic-portal';
import { SiteFooterCredit } from '../components/site-footer-credit';
import { ClipboardList, Wrench } from 'lucide-react';

export default async function MechanicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer();
  if (!viewer || viewer.isGuest || viewer.role !== 'MECHANIC')
    redirect(roleHomePath(viewer?.role));

  return (
    <div className="mechanic-console mechanic-app-shell">
      <aside className="mechanic-sidebar" aria-label="Mechanic workspace">
        <Link className="mechanic-brand" href="/mechanic">
          <Image
            src="/royal-mechanics-logo-alpha.png"
            alt="Royal Mechanics"
            width={38}
            height={38}
            sizes="38px"
            priority
          />
          <span>
            ROYAL MECHANICS <small>WORKSHOP OPERATIONS</small>
          </span>
        </Link>
        <div className="mechanic-role-badge"><Wrench size={14} /> MECHANIC PORTAL</div>
        <nav className="mechanic-nav" aria-label="Mechanic navigation">
          <Link href="/mechanic"><ClipboardList size={17} /> My job queue</Link>
        </nav>
        <div className="mechanic-sidebar-footer">
          <span>Signed in as</span>
          <strong>{viewer.displayName}</strong>
          <MechanicSignout />
        </div>
      </aside>
      <div className="mechanic-workspace">
        <header className="mechanic-topbar">
          <div>
            <p className="mechanic-topbar-kicker">LIVE WORKBOARD</p>
            <span>Workshop floor · {viewer.displayName}</span>
          </div>
          <div className="mechanic-online"><i /> On shift</div>
        </header>
        <main>{children}</main>
        <footer className="portal-credit-footer"><SiteFooterCredit /></footer>
      </div>
    </div>
  );
}
