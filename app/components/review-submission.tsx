'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, CheckCircle2, Star } from 'lucide-react';
import { requestWithMinimum as fetch } from '@/lib/minimum-request';
import { triggerHaptic } from '@/lib/haptics';
import { Loader, useMinimumBusy } from './loader';
// The customer layout owns the single shared footer for every public route.
const PublicFooter = () => null;

type Job = { _id: string; vehicleName: string; serviceCategory: string; requestNumber: string };
export function ReviewSubmissionPage({ jobs }: { jobs: Job[] }) {
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useMinimumBusy();
  const [message, setMessage] = useState('');
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rating) { setMessage('Choose a star rating before submitting.'); return; }
    triggerHaptic('medium'); setBusy(true); setMessage('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: form.get('bookingId'), rating, text: form.get('text') }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not submit your review.');
      triggerHaptic('success'); setMessage('Thank you. Your review is pending workshop approval.'); event.currentTarget.reset(); setRating(0);
    } catch (error) { triggerHaptic('error'); setMessage(error instanceof Error ? error.message : 'Could not submit your review.'); }
    finally { setBusy(false); }
  }
  return <><main className="public-main utility-page"><section className="page-intro"><p>RIDER REVIEWS</p><h1>Share your experience.</h1><span>Reviews appear on the site after workshop approval.</span></section><section className="review-submit-card glass-card">{jobs.length ? <form onSubmit={submit} aria-busy={busy}><label>Service to review<select name="bookingId" required defaultValue=""><option value="" disabled>Choose a completed service</option>{jobs.map((job) => <option key={job._id} value={job._id}>{job.vehicleName} · {job.serviceCategory} ({job.requestNumber})</option>)}</select></label><fieldset className="review-stars" disabled={busy}><legend>Your rating</legend><div role="radiogroup" aria-label="Star rating">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" aria-label={`${value} star${value === 1 ? '' : 's'}`} aria-pressed={rating === value} onClick={() => { triggerHaptic('light'); setRating(value); }}><Star size={27} fill={value <= rating ? 'currentColor' : 'none'} /></button>)}</div></fieldset><label>Your experience<textarea name="text" required maxLength={1500} rows={5} placeholder="Tell riders what stood out about your service…" /></label><button className="gloss-button" disabled={busy} type="submit">{busy ? <Loader size="button" /> : <Star size={16} />} Submit for approval <ArrowRight size={15} /></button></form> : <div className="review-no-history"><CheckCircle2 size={28} /><h2>No completed service to review yet.</h2><p>Once a workshop job is marked complete, it will be available here.</p><Link className="gloss-button" href="/garage">View your garage <ArrowRight size={15} /></Link></div>}{message && <output className={message.startsWith('Thank') ? 'review-success' : 'review-error'}>{message}</output>}</section></main><PublicFooter /></>;
}
