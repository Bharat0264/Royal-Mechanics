import { PublicHeader } from '@/app/components/public-header';
export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicHeader />
      {children}
    </>
  );
}
