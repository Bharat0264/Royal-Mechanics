'use client';
import { triggerHaptic } from '@/lib/haptics';
import { requestWithMinimum as fetch } from '@/lib/minimum-request';
import { Loader, useMinimumBusy } from './loader';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Bike, LogOut, Star } from 'lucide-react';
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
  intakePhotos?: string[];
  faults?: {
    text: string;
    beforePhoto?: string;
    afterPhoto?: string;
    completed?: boolean;
  }[];
};
type Invoice = {
  _id: string;
  invoiceNumber: string;
  vehicleName: string;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }[];
  total: number;
  tax?: number;
  paymentStatus: 'UNPAID' | 'PAID';
  deliveredAt?: string;
};
export function CustomerDashboard({
  viewer,
  bookings,
  invoices,
}: {
  viewer: Viewer;
  bookings: Booking[];
  invoices: Invoice[];
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useMinimumBusy();
  async function pay(invoiceId: string) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/payments/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      });
      const order = await response.json();
      if (!response.ok) throw new Error(order.error);
      if (!window.Razorpay)
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve();
          script.onerror = () =>
            reject(new Error('Could not load secure payment checkout.'));
          document.body.appendChild(script);
        });
      const Razorpay = window.Razorpay;
      if (!Razorpay)
        throw new Error('Could not start secure payment checkout.');
      const checkout = new Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Royal Mechanics',
        description: order.invoiceNumber,
        order_id: order.orderId,
        handler: async (payment: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          setBusy(true);
          try {
            const verify = await fetch('/api/payments/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ invoiceId, ...payment }),
            });
            const result = await verify.json();
            if (!verify.ok)
              throw new Error(result.error || 'Payment verification failed.');
            triggerHaptic('success');
            setMessage(
              `Payment received for ${result.invoiceNumber}. Your receipt is ready.`,
            );
            window.location.reload();
          } catch (error) {
            triggerHaptic('error');
            setMessage(
              error instanceof Error
                ? error.message
                : 'Payment verification failed.',
            );
          } finally {
            setBusy(false);
          }
        },
      });
      checkout.on('payment.failed', () => {
        triggerHaptic('error');
        setMessage('Payment failed. Please try again.');
      });
      checkout.open();
    } catch (error) {
      triggerHaptic('error');
      setMessage(
        error instanceof Error
          ? error.message
          : 'Payment could not be started.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function review(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    triggerHaptic('medium');
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
      triggerHaptic('success');
      setMessage('Thank you. Your review has been sent for approval.');
      form.reset();
    } catch (e) {
      triggerHaptic('error');
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
              triggerHaptic('light');
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
          {viewer.role === 'CUSTOMER' ? (
            <Link className="admin-gold" href="/book-service">
              Book a service <ArrowRight size={14} />
            </Link>
          ) : (
            <span className="admin-date">MECHANIC CONSOLE</span>
          )}
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
        {viewer.role === 'CUSTOMER' &&
          bookings.some((b) => b.intakePhotos?.length || b.faults?.length) && (
            <section className="admin-widget" style={{ marginTop: 25 }}>
              <div className="admin-widget-heading">
                <h2>Service evidence</h2>
              </div>
              {bookings
                .filter((b) => b.intakePhotos?.length || b.faults?.length)
                .map((b) => (
                  <details
                    key={`evidence-${b._id}`}
                    className="admin-list-item"
                  >
                    <summary>
                      {b.vehicleName} — photos and repair checklist
                    </summary>
                    <div className="admin-photo-grid">
                      {b.intakePhotos?.map((src, i) => (
                        <a
                          key={src}
                          href={src}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Image
                            src={src}
                            width={180}
                            height={130}
                            unoptimized
                            alt={`Intake ${i + 1}`}
                          />
                        </a>
                      ))}
                    </div>
                    {b.faults?.map((fault) => (
                      <div key={fault.text}>
                        <p>
                          {fault.completed ? '✓' : '•'} {fault.text}
                        </p>
                        <div className="admin-photo-grid">
                          {[fault.beforePhoto, fault.afterPhoto]
                            .filter(Boolean)
                            .map((src, i) => (
                              <a
                                key={src}
                                href={src}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Image
                                  src={src!}
                                  width={180}
                                  height={130}
                                  unoptimized
                                  alt={i ? 'Repair after' : 'Repair before'}
                                />
                              </a>
                            ))}
                        </div>
                      </div>
                    ))}
                  </details>
                ))}
            </section>
          )}
        {viewer.role === 'CUSTOMER' && (
          <section className="admin-widget" style={{ marginTop: 25 }}>
            <div className="admin-widget-heading">
              <h2>Bills &amp; payments</h2>
            </div>
            {invoices.length ? (
              invoices.map((invoice) => (
                <details key={invoice._id} className="admin-list-item">
                  <summary>
                    {invoice.invoiceNumber} · {invoice.vehicleName} · ₹
                    {invoice.total.toLocaleString('en-IN')} ·{' '}
                    {invoice.paymentStatus}
                  </summary>
                  <div className="admin-muted">
                    {invoice.items.map((item) => (
                      <p key={item.name}>
                        {item.name} × {item.quantity} — ₹
                        {item.amount.toLocaleString('en-IN')}
                      </p>
                    ))}
                    {invoice.tax ? (
                      <p>Tax — ₹{invoice.tax.toLocaleString('en-IN')}</p>
                    ) : null}
                  </div>
                  {invoice.paymentStatus === 'UNPAID' ? (
                    <button
                      className="admin-gold"
                      disabled={busy}
                      onClick={() => {
                        triggerHaptic('light');
                        return pay(invoice._id);
                      }}
                    >
                      {busy && <Loader size="button" />}Pay now ₹
                      {invoice.total.toLocaleString('en-IN')}
                    </button>
                  ) : (
                    <p className="admin-success">
                      Paid receipt
                      {invoice.deliveredAt
                        ? ' and service package delivered.'
                        : ' confirmed.'}
                    </p>
                  )}
                </details>
              ))
            ) : (
              <p className="admin-muted">
                Your generated bills will appear here with their full breakdown.
              </p>
            )}
            {message && <output>{message}</output>}
          </section>
        )}
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
                <button
                  className="admin-gold"
                  onClick={() => triggerHaptic('light')}
                >
                  {busy ? <Loader size="button" /> : <Star size={15} />} Submit
                  review
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

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, callback: () => void) => void;
    };
  }
}
