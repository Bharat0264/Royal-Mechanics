import Link from 'next/link';
export const metadata = { title: 'Account terms | Royal Mechanics' };
export default function Page() {
  return (
    <main className="public-main utility-page">
      <article
        className="glass-card"
        style={{ maxWidth: 760, margin: 'auto', padding: 35, lineHeight: 1.8 }}
      >
        <p className="kicker">ROYAL MECHANICS</p>
        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 38 }}>
          Account terms
        </h1>
        <p>
          Use your account to request servicing, view workshop updates, and
          share your experience. Please provide accurate contact and vehicle
          details and keep your password private.
        </p>
        <p>
          A booking request does not guarantee a slot or final price. The
          workshop confirms availability and the estimate before work proceeds.
          Contact the workshop about changes, cancellations, or questions about
          your service.
        </p>
        <p>
          Reviews must describe your own experience. Reviews are checked before
          publication. Accounts may be restricted for misuse.
        </p>
        <Link href="/contact">Contact the workshop</Link> ·{' '}
        <Link href="/sign-in">Back to sign in</Link>
      </article>
    </main>
  );
}
