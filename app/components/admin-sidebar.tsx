import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { X } from 'lucide-react';

export function AdminSidebar({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <aside className="admin-sidebar" aria-label="Workshop administration">
      <Link className="admin-sidebar-crest" href="/admin" aria-label="Royal Mechanics admin dashboard">
        <Image src="/royal-mechanics-logo-alpha.png" alt="" width={44} height={44} sizes="44px" unoptimized priority />
      </Link>
      <button className="admin-drawer-close" type="button" aria-label="Close navigation" onClick={onClose}>
        <X size={19} />
      </button>
      {children}
    </aside>
  );
}
