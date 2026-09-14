'use client';

export function SiteFooterCredit() {
  const year = new Date().getFullYear();
  return (
    <div className="site-footer-credit">
      <p>© {year} Royal Mechanics. All Rights Reserved.</p>
      <p>Website designed &amp; developed by B&amp;M Works.</p>
    </div>
  );
}
