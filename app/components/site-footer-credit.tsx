'use client';

export function SiteFooterCredit() {
  const year = new Date().getFullYear();
  return (
    <div className="site-footer-credit">
      <p>© {year} Royal Mechanics. All Rights Reserved.</p>
    </div>
  );
}
