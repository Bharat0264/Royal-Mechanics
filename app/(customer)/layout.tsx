import { PublicHeader } from '@/app/components/public-header';
import { PublicFooter } from '@/app/components/public-site';
export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="customer-shell">
      <PublicHeader />
      <div className="customer-shell-main">{children}</div>
      <PublicFooter />
    </div>
  );
}
