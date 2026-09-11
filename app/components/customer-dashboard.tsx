'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Bike, LogOut, Star, LoaderCircle } from 'lucide-react';
import { haptic } from './internal-feedback';
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
  faults?: { text: string; beforePhoto?: string; afterPhoto?: string; completed?: boolean }[];
};
type Invoice = { _id: string; invoiceNumber: string; vehicleName: string; items: { name: string; quantity: number; unitPrice: number; amount: number }[]; total: number; tax?: number; paymentStatus: 'UNPAID' | 'PAID'; deliveredAt?: string };
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
  const [busy, setBusy] = useState(false);
  async function pay(invoiceId: string) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/payments/razorpay/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId }) });
      const order = await response.json(); if (!response.ok) throw new Error(order.error);
      if (!window.Razorpay) await new Promise<void>((resolve, reject) => { const script = document.createElement('script'); script.src = 'https://checkout.razorpay.com/v1/checkout.js'; script.onload = () => resolve(); script.onerror = () => reject(new Error('Could not load secure payment checkout.')); document.body.appendChild(script); });
      const Razorpay = window.Razorpay; if (!Razorpay) throw new Error('Could not start secure payment checkout.');
      new Razorpay({ key: order.keyId, amount: order.amount, currency: order.currency, name: 'Royal Mechanics', description: order.invoiceNumber, order_id: order.orderId, handler: async (payment: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => { const verify = await fetch('/api/payments/razorpay/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId, ...payment }) }); const result = await verify.json(); if (!verify.ok) { setMessage(result.error || 'Payment verification failed.'); return; } setMessage(`Payment received for ${result.invoiceNumber}. Your receipt is ready.`); window.location.reload(); } }).open();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Payment could not be started.'); } finally { setBusy(false); }
  }
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
          {viewer.role === 'CUSTOMER' ? <Link className="admin-gold" href="/book-service">Book a service <ArrowRight size={14} /></Link> : <span className="admin-date">MECHANIC CONSOLE</span>}
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
        {viewer.role === 'CUSTOMER' && bookings.some((b) => (b.intakePhotos?.length || b.faults?.length)) && <section className="admin-widget" style={{ marginTop: 25 }}><div className="admin-widget-heading"><h2>Service evidence</h2></div>{bookings.filter((b) => b.intakePhotos?.length || b.faults?.length).map((b) => <details key={`evidence-${b._id}`} className="admin-list-item"><summary>{b.vehicleName} — photos and repair checklist</summary><div className="admin-photo-grid">{b.intakePhotos?.map((src, i) => <a key={src} href={src} target="_blank" rel="noreferrer"><Image src={src} width={180} height={130} unoptimized alt={`Intake ${i + 1}`} /></a>)}</div>{b.faults?.map((fault) => <div key={fault.text}><p>{fault.completed ? '✓' : '•'} {fault.text}</p><div className="admin-photo-grid">{[fault.beforePhoto, fault.afterPhoto].filter(Boolean).map((src, i) => <a key={src} href={src} target="_blank" rel="noreferrer"><Image src={src!} width={180} height={130} unoptimized alt={i ? 'Repair after' : 'Repair before'} /></a>)}</div></div>)}</details>)}</section>}
        {viewer.role === 'MECHANIC' && bookings.map((b) => <section className="admin-widget" style={{ marginTop: 18 }} key={`job-${b._id}`}><div className="admin-widget-heading"><h2>{b.vehicleName} — evidence checklist</h2></div><MechanicJob booking={b} onMessage={setMessage} /></section>)}
        {viewer.role === 'CUSTOMER' && <section className="admin-widget" style={{ marginTop: 25 }}><div className="admin-widget-heading"><h2>Bills &amp; payments</h2></div>{invoices.length ? invoices.map((invoice) => <details key={invoice._id} className="admin-list-item"><summary>{invoice.invoiceNumber} · {invoice.vehicleName} · ₹{invoice.total.toLocaleString('en-IN')} · {invoice.paymentStatus}</summary><div className="admin-muted">{invoice.items.map((item) => <p key={item.name}>{item.name} × {item.quantity} — ₹{item.amount.toLocaleString('en-IN')}</p>)}{invoice.tax ? <p>Tax — ₹{invoice.tax.toLocaleString('en-IN')}</p> : null}</div>{invoice.paymentStatus === 'UNPAID' ? <button className="admin-gold" disabled={busy} onClick={() => pay(invoice._id)}>Pay now ₹{invoice.total.toLocaleString('en-IN')}</button> : <p className="admin-success">Paid receipt{invoice.deliveredAt ? ' and service package delivered.' : ' confirmed.'}</p>}</details>) : <p className="admin-muted">Your generated bills will appear here with their full breakdown.</p>}{message && <output>{message}</output>}</section>}
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

async function compressPhoto(file: File) {
  const source = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read photo.')); reader.readAsDataURL(file); });
  const photo = new window.Image(); photo.src = source; await new Promise((resolve, reject) => { photo.onload = resolve; photo.onerror = reject; });
  const scale = Math.min(1, 1280 / Math.max(photo.width, photo.height)); const canvas = document.createElement('canvas'); canvas.width = Math.round(photo.width * scale); canvas.height = Math.round(photo.height * scale); canvas.getContext('2d')?.drawImage(photo, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.76);
}
function PhotoPicker({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { const [error, setError] = useState(''); return <label>{label}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { setError(''); onChange(await compressPhoto(file)); haptic.capture(); } catch { haptic.error(); setError('Could not prepare this photo. Try another one.'); } }} />{value && <small className="admin-success">Photo added ✓</small>}{error && <small className="admin-error">{error}</small>}</label>; }
function MechanicJob({ booking, onMessage }: { booking: Booking; onMessage: (message: string) => void }) {
  const [photos, setPhotos] = useState(['', '', '', '']); const [faultText, setFaultText] = useState(''); const [faults, setFaults] = useState<string[]>([]); const [busy, setBusy] = useState(false);
  const submit = async (action: string, data: object = {}) => { setBusy(true); const res = await fetch(`/api/jobs/${booking._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...data }) }); const json = await res.json(); setBusy(false); if (json.ok) haptic.success(); else haptic.error(); onMessage(json.error || (json.ok ? 'Job evidence saved.' : 'Could not update job.')); if (json.ok) window.location.reload(); };
  return <div className="admin-form"><p className="admin-muted">Use your camera or choose a photo. A job can be marked ready only after all required evidence is attached.</p>{booking.intakePhotos?.length === 4 ? <p className="admin-success">Four intake photos recorded.</p> : <><div className="admin-grid">{['Front', 'Back', 'Left', 'Right'].map((side, index) => <PhotoPicker key={side} label={`${side} intake photo`} value={photos[index]} onChange={(value) => setPhotos(photos.map((p, i) => i === index ? value : p))} />)}</div><button className="admin-secondary" disabled={busy || photos.some((photo) => !photo)} onClick={() => submit('intake', { photos })}>Save 4 intake photos</button></>}{booking.intakePhotos?.length === 4 && !booking.faults?.length && <><label>Fault found<input value={faultText} maxLength={300} onChange={(e) => setFaultText(e.target.value)} placeholder="e.g. Replace worn rear brake pads" /></label><button type="button" className="admin-secondary" disabled={!faultText.trim() || faults.length >= 30} onClick={() => { setFaults([...faults, faultText.trim()]); setFaultText(''); }}>Add another fault</button>{faults.length > 0 && <div className="admin-list-item">{faults.map((fault, index) => <p key={`${fault}-${index}`}>{index + 1}. {fault}</p>)}</div>}<button className="admin-gold" disabled={busy || !faults.length} onClick={() => submit('faults', { faults })}>Create repair checklist</button></>}{booking.faults?.map((fault, index) => <Fault key={`${fault.text}-${index}`} fault={fault} disabled={busy} save={(data) => submit('fault', { index, ...data })} />)}{booking.faults?.length ? <button className="admin-gold" disabled={busy} onClick={() => submit('ready')}>Mark vehicle ready for approval</button> : null}</div>;
}
function Fault({ fault, disabled, save }: { fault: NonNullable<Booking['faults']>[number]; disabled: boolean; save: (data: object) => void }) { const [beforePhoto, setBefore] = useState(fault.beforePhoto || ''); const [afterPhoto, setAfter] = useState(fault.afterPhoto || ''); return <div className="admin-list-item"><strong>{fault.completed ? '✓ ' : ''}{fault.text}</strong><div className="admin-grid"><PhotoPicker label="Before repair photo" value={beforePhoto} onChange={setBefore} /><PhotoPicker label="After repair photo" value={afterPhoto} onChange={setAfter} /></div><button className="admin-secondary" disabled={disabled || !beforePhoto || !afterPhoto} onClick={() => save({ beforePhoto, afterPhoto })}>Save photos</button> <button className="admin-gold" disabled={disabled || !beforePhoto || !afterPhoto || fault.completed} onClick={() => save({ beforePhoto, afterPhoto, completed: true })}>Mark fixed</button></div>; }

declare global { interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } } }
