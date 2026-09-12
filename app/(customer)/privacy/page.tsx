import Link from 'next/link';
export const metadata = { title: 'Account privacy | Royal Mechanics' };
export default function Page() {
  return (
    <main className="public-main utility-page">
      <article
        className="glass-card"
        style={{ maxWidth: 760, margin: 'auto', padding: 35, lineHeight: 1.8 }}
      >
        <p className="kicker">ROYAL MECHANICS</p>
        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 38 }}>
          Your account & privacy
        </h1>
        <p>
          Royal Mechanics stores your name, email, phone number, and service
          records to manage your account and workshop bookings. Passwords are
          stored as salted hashes. Secure session cookies keep you signed in.
        </p>
        <p>
          If you choose Google, we use your verified email and profile name to
          identify your account. Password reset emails are delivered through our
          email provider when configured.
        </p>
        <p>
          Workshop administrators can access customer and booking records.
          Approved reviews display your name, vehicle, rating, and review
          publicly. Contact the workshop to ask about your records, request
          corrections, or request account removal.
        </p>
        <Link href="/contact">Contact the workshop</Link> ·{' '}
        <Link href="/login">Back to login</Link>
      </article>
    </main>
  );
}
