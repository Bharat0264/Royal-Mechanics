import type { ReactNode } from 'react';
export function AdminSidebar({ children }: { children: ReactNode }) {
  return (
    <aside className="admin-sidebar" aria-label="Workshop administration">
      {children}
    </aside>
  );
}
