'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Bike, LogOut, Star, LoaderCircle } from 'lucide-react';
import type { Viewer } from '@/lib/auth';
import { statusLabel } from '@/lib/site-defaults';
import './admin.css';
type Booking = {
  _id: string;
  requestNumber: string;
  vehicleName: string;
  serviceCategory: string;
  status: string;
  estimate?: number;
  estimateApproved?: boolean;
};
export function CustomerDashboard({
  viewer,
  bookings,
}: {
  viewer: Viewer;
  bookings: Booking[];
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function review(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = e.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, rating: Number(values.rating) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage('Thank you. Your review has been sent for approval.');
      form.reset();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not send review.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-shell">
      <main className="admin-main" style={{ width: '100%', maxWidth: 1100 }}>
        <div className="admin-title-row">
          <Link href="/">
            <Image
              src="/royal-mechanics-logo-alpha.png"
              width={78}
              height={78}
              alt="Royal Mechanics home"
            />
          </Link>
          <button
            className="admin-secondary"
            onClick={async () => {
              await fetch('/api/auth/signout', { method: 'POST' });
              window.location.assign('/');
            }}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
        <div className="admin-title-row">
          <div>
            <p className="admin-eyebrow">YOUR ROYAL MECHANICS ACCOUNT</p>
            <h1>
              {viewer.role === 'MECHANIC'
                ? 'Your work, in focus.'
                : `Welcome back, ${viewer.displayName?.split(' ')[0] || 'rider'}.`}
            </h1>
            <p className="admin-muted">
              {viewer.role === 'MECHANIC'
                ? 'Your current workshop assignments.'
                : 'Your bikes. Your service history. A little peace of mind.'}
            </p>
          </div>
          <Link className="admin-gold" href="/book-service">
            Book a service <ArrowRight size={14} />
          </Link>
        </div>
        <section className="admin-widget">
          <div className="admin-widget-heading">
            <h2>
              {viewer.role === 'MECHANIC' ? 'Assigned jobs' : 'Your garage'}
            </h2>
            <Bike size={20} />
          </div>
          {bookings.length ? (
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Booking</th>
                    <th>Vehicle</th>
                    <th>Service</th>
                    <th>Status</th>
                    <th>Estimate</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b._id}>
                      <td>{b.requestNumber}</td>
                      <td>{b.vehicleName}</td>
                      <td>{b.serviceCategory}</td>
                      <td>
                        <span className={`admin-status status-${b.status}`}>
                          {statusLabel(b.status)}
                        </span>
                      </td>
                      <td>
                        {b.estimate
                          ? `₹${b.estimate.toLocaleString('en-IN')}`
                          : 'Not yet estimated'}
                        {b.estimateApproved && <small>Approved</small>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-empty">
              <Bike />
              <h3>Your next chapter starts here.</h3>
              <p>
                Book your first service to start building your bike’s care
                history.
              </p>
            </div>
          )}
        </section>
        {viewer.role === 'CUSTOMER' && (
          <section className="admin-widget" style={{ marginTop: 25 }}>
            <div className="admin-widget-heading">
              <h2>How was your ride?</h2>
              <Star size={18} />
            </div>
            <form className="admin-form" onSubmit={review}>
              <fieldset disabled={busy}>
                <label>
                  Vehicle
                  <input
                    name="vehicle"
                    required
                    maxLength={100}
                    placeholder="Your bike or scooter"
                  />
                </label>
                <label>
                  Your rating
                  <select name="rating" defaultValue="5">
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} stars
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Your experience
                  <textarea
                    name="text"
                    required
                    maxLength={1500}
                    rows={3}
                    placeholder="Tell us about your service…"
                  />
                </label>
                <button className="admin-gold">
                  {busy ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <Star size={15} />
                  )}{' '}
                  Submit review
                </button>
                {message && <output>{message}</output>}
              </fieldset>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
