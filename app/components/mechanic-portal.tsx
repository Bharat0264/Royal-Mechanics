'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  Images,
  Tag,
  Wrench,
} from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';
import { requestWithMinimum as fetch } from '@/lib/minimum-request';
import { GlassPanel } from './glass-panel';
import { Loader, useMinimumBusy } from './loader';
export type MechanicBooking = {
  _id: string;
  requestNumber: string;
  vehicleName: string;
  customerId?: { displayName?: string };
  status: string;
  intakePhotos: string[];
  faults: {
    text: string;
    beforePhoto?: string;
    afterPhoto?: string;
    completed: boolean;
  }[];
};
export function MechanicSignout() {
  const [busy, setBusy] = useMinimumBusy();
  const [error, setError] = useState('');
  return (
    <div className="mechanic-signout">
      <button
        className="mechanic-signout-button"
        disabled={busy}
        onClick={async () => {
          triggerHaptic('light');
          setBusy(true);
          try {
            const result = await fetch('/api/auth/signout', { method: 'POST' });
            if (!result.ok) throw new Error('Sign out failed.');
            window.location.assign('/login');
          } catch {
            triggerHaptic('error');
            setError('Unable to sign out. Try again.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader size="button" /> : 'Sign out'}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function MechanicSetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useMinimumBusy();
  const [error, setError] = useState('');
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    triggerHaptic('medium');
    if (password !== confirm) {
      triggerHaptic('error');
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || 'Unable to save password.');
      triggerHaptic('success');
      window.location.assign(result.redirect);
    } catch (cause) {
      triggerHaptic('error');
      setError(
        cause instanceof Error ? cause.message : 'Unable to save password.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <GlassPanel className="job-editor">
      <p className="console-kicker">FIRST SIGN-IN</p>
      <h1>Set your workshop password</h1>
      <p>Choose a password before opening your assigned job queue.</p>
      <form onSubmit={submit}>
        <label>
          New password
          <input
            required
            minLength={10}
            maxLength={128}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label>
          Confirm password
          <input
            required
            minLength={10}
            maxLength={128}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button disabled={busy} type="submit">
          {busy ? <Loader size="button" /> : 'Save and open jobs'}
        </button>
      </form>
    </GlassPanel>
  );
}

export function MechanicQueue({ jobs }: { jobs: MechanicBooking[] }) {
  const [filter, setFilter] = useState('ALL');
  const active = jobs.filter(
    (job) => !['COMPLETED', 'CANCELLED'].includes(job.status),
  );
  const statusCount = (status: string) =>
    active.filter((job) => job.status === status).length;
  const statusName = (status: string) => status.replaceAll('_', ' ');
  const visible = filter === 'ALL' ? active : active.filter((job) => job.status === filter);
  const statuses = [
    ['ALL', 'All work'],
    ['ASSIGNED', 'Assigned'],
    ['IN_PROGRESS', 'In progress'],
    ['QUALITY_CHECK', 'Quality check'],
  ] as const;
  return (
    <>
      <div className="mechanic-queue-controls">
        <section className="mechanic-queue-heading">
          <div>
            <p className="console-kicker">TODAY’S WORKLOAD</p>
            <h1>Job queue</h1>
            <p>Track each vehicle from intake to final inspection.</p>
          </div>
          <div className="queue-total"><strong>{active.length}</strong><span>active vehicles</span></div>
        </section>
        <div className="job-filter-tabs" aria-label="Filter jobs by status">
          {statuses.map(([status, label]) => (
            <button key={status} type="button" className={filter === status ? 'is-active' : ''} onClick={() => setFilter(status)}>
              {label} <b>{status === 'ALL' ? active.length : statusCount(status)}</b>
            </button>
          ))}
        </div>
      </div>
      <div className="job-queue">
        {visible.map((job, index) => (
          <GlassPanel
            className="job-card mechanic-enter"
            key={job._id}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <small className="job-id">
              <Tag size={14} aria-hidden="true" />
              {job.requestNumber}
            </small>
            <div className="job-title">
              <Wrench size={17} aria-hidden="true" />
              <h2>{job.vehicleName}</h2>
              <span className="job-status" data-status={job.status}>
                {statusName(job.status)}
              </span>
            </div>
            <span className="job-customer">{job.customerId?.displayName || 'Walk-in customer'}</span>
            <div className="job-progress" aria-label="Repairs completed">
              <i
                style={{
                  width: `${job.faults.length ? Math.min(100, Math.max(0, (job.faults.filter((f) => f.completed).length / job.faults.length) * 100)) : 0}%`,
                }}
              />
            </div>
            <span className="job-repair-count">
              {job.faults.filter((f) => f.completed).length}/{job.faults.length}{' '}
              repairs complete
            </span>
            <Link className="job-open" href={`/mechanic/jobs/${job._id}`}>
              Open job <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </GlassPanel>
        ))}
        {!visible.length && (
          <GlassPanel className="job-empty-state">
            <Wrench size={30} aria-hidden="true" />
            <div>
              <h2>No jobs assigned right now</h2>
              <p><CalendarDays size={15} aria-hidden="true" /> Assigned vehicles will appear here as soon as they are scheduled.</p>
            </div>
          </GlassPanel>
        )}
      </div>
    </>
  );
}
type ImageFormat = 'jpeg' | 'png' | 'webp' | 'gif' | 'heic' | 'avif' | 'unknown';
const signature = (bytes: Uint8Array): ImageFormat => {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'webp';
  if (String.fromCharCode(...bytes.slice(0, 3)) === 'GIF') return 'gif';
  const brand = String.fromCharCode(...bytes.slice(8, 12)).toLowerCase();
  if (String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp' && ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) return 'heic';
  if (String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp' && brand === 'avif') return 'avif';
  return 'unknown';
};

async function preparePhoto(original: File) {
  let file = original;
  try {
    if (!file.size) throw new Error('This photo is empty. Please take or select it again.');
    // A safety ceiling for device memory. Normal large camera photos are resized below.
    if (file.size > 100_000_000) throw new Error('This photo is over 100 MB. Please choose a smaller photo.');
    const format = signature(new Uint8Array(await file.slice(0, 32).arrayBuffer()));
    if (format === 'unknown') throw new Error('This file is not a readable image. Choose a photo from your camera or library.');
    if (format === 'heic') {
      const { default: heic2any } = await import('heic2any');
      const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.82 });
      const jpeg = Array.isArray(converted) ? converted[0] : converted;
      if (!jpeg) throw new Error('The HEIC photo could not be converted. Please try another photo.');
      file = new File([jpeg], `${file.name.replace(/\.[^.]+$/, '') || 'camera-photo'}.jpg`, { type: 'image/jpeg' });
    }
  } catch (error) {
    console.error('mechanic-photo-validation-failed', { name: original.name, type: original.type, size: original.size, error });
    throw error;
  }
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    if (!bitmap.width || !bitmap.height) throw new Error('This photo has no readable dimensions. Please choose another photo.');
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare this image.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.72);
  } catch (error) {
    console.error('mechanic-photo-decode-failed', { name: original.name, type: original.type, size: original.size, error });
    throw new Error('This photo could not be read by your device. Try a JPEG, PNG, or WebP photo from the camera or gallery.');
  }
}
function Capture({
  label,
  onSave,
  onClose,
}: {
  label: string;
  onSave: (photo: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const [busy, setBusy] = useMinimumBusy();
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);
  function close() {
    setClosing(true);
    window.setTimeout(onClose, 180);
  }
  async function read(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const photo = await preparePhoto(file);
      triggerHaptic('capture');
      onSave(photo);
      close();
    } catch (e) {
      triggerHaptic('error');
      setError(e instanceof Error ? e.message : 'Photo could not be loaded.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className={`capture-screen ${closing ? 'is-closing' : ''}`}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <h2>{label}</h2>
      <p>Take a clear photo or select one from your library.</p>
      <div className="capture-tiles" aria-busy={busy}>
        <label className="upload-tile">
          <Camera aria-hidden="true" />
          <span>Open camera</span>
          <small>Capture a fresh intake photo</small>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            disabled={busy}
            onChange={(e) => void read(e.target.files?.[0])}
          />
        </label>
        <label className="upload-tile">
          <Images aria-hidden="true" />
          <span>Choose from library</span>
          <small>Select an existing vehicle photo</small>
          <input
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={(e) => void read(e.target.files?.[0])}
          />
        </label>
      </div>
      {busy && <Loader size="button" />}
      {error && <p role="alert">{error}</p>}
      <button
        onClick={() => {
          triggerHaptic('light');
          close();
        }}
      >
        Cancel
      </button>
    </dialog>
  );
}
export function MechanicJobEditor({ initial }: { initial: MechanicBooking }) {
  const [job, setJob] = useState(initial);
  const [photos, setPhotos] = useState(
    initial.intakePhotos.length === 4 ? initial.intakePhotos : ['', '', '', ''],
  );
  const [text, setText] = useState('');
  const [busy, setBusy] = useMinimumBusy();
  const [message, setMessage] = useState('');
  const [capture, setCapture] = useState<{
    label: string;
    save: (photo: string) => void;
  } | null>(null);
  const locked = ['COMPLETED', 'CANCELLED', 'QUALITY_CHECK'].includes(
    job.status,
  );
  async function save(action: string, data: object = {}) {
    triggerHaptic('medium');
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/jobs/${job._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...data }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setJob(result.booking);
      setText('');
      setMessage(
        action === 'ready'
          ? 'Vehicle ready. Admin can review the job.'
          : 'Saved.',
      );
      triggerHaptic('success');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to save.');
      triggerHaptic('error');
    } finally {
      setBusy(false);
    }
  }
  function photoButton(
    label: string,
    value: string | undefined,
    onSave: (photo: string) => void,
  ) {
    return (
      <div className="photo-slot">
        <button
          className="mechanic-action"
          type="button"
          disabled={busy || locked}
          onClick={() => {
            triggerHaptic('light');
            setCapture({ label, save: onSave });
          }}
        >
          {value ? 'Replace' : 'Add'} {label}
        </button>
        {value && (
          <Image unoptimized src={value} width={160} height={120} alt={label} />
        )}
      </div>
    );
  }
  return (
    <>
      <section className="job-detail-heading" aria-label="Job details">
        <Link className="mechanic-back" href="/mechanic">
          <ArrowLeft size={16} aria-hidden="true" /> Job queue
        </Link>
        <div className="job-detail-title">
          <Wrench size={20} aria-hidden="true" />
          <h1>{job.vehicleName}</h1>
        </div>
        <div className="job-detail-meta">
          <span className="job-id">
            <Tag size={14} aria-hidden="true" />
            {job.requestNumber}
          </span>
          <span className="job-status" data-status={job.status}>
            {job.status.replaceAll('_', ' ')}
          </span>
        </div>
      </section>
      <GlassPanel className="job-editor">
        {message && (
          <output className="console-message">
            {message}
          </output>
        )}
        {busy && <Loader size="button" />}
        <h2>Four-side intake</h2>
        <div className="photo-controls">
          {['Front', 'Back', 'Left', 'Right'].map((side, i) => (
            <div key={side}>
              {photoButton(side, photos[i], (photo) =>
                setPhotos((previous) =>
                  previous.map((p, j) => (i === j ? photo : p)),
                ),
              )}
            </div>
          ))}
        </div>
        {!locked && (
          <button
            className="mechanic-action"
            disabled={busy || photos.some((p) => !p)}
            onClick={() => {
              triggerHaptic('light');
              void save('intake', { photos });
            }}
          >
            Save intake photos
          </button>
        )}
        {job.intakePhotos.length === 4 && (
          <>
            <h2>Repair checklist</h2>
            {!locked && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void save('addFault', { text });
                }}
              >
                <label>
                  Fault found
                  <input
                    required
                    maxLength={300}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Describe one repair"
                  />
                </label>
                <button
                  className="mechanic-action"
                  disabled={busy || !text.trim()}
                  onClick={() => triggerHaptic('light')}
                >
                  Add fault
                </button>
              </form>
            )}
            {job.faults.map((fault, index) => (
              <GlassPanel className="job-editor" key={index}>
                <label className="repair-toggle">
                  <input
                    type="checkbox"
                    checked={fault.completed}
                    disabled={
                      busy || locked || !fault.beforePhoto || !fault.afterPhoto
                    }
                    onChange={(e) => {
                      void save('fault', {
                        index,
                        completed: e.target.checked,
                      });
                    }}
                  />
                  <span className="repair-check" aria-hidden="true">
                    <Check size={14} />
                  </span>
                  <span>{fault.text}</span>
                </label>
                <div className="photo-controls">
                  {photoButton(
                    'Before photo',
                    fault.beforePhoto,
                    (photo) =>
                      void save('fault', { index, beforePhoto: photo }),
                  )}
                  {photoButton(
                    'After photo',
                    fault.afterPhoto,
                    (photo) => void save('fault', { index, afterPhoto: photo }),
                  )}
                </div>
                {(!fault.beforePhoto || !fault.afterPhoto) && (
                  <small>Attach both photos to enable completion.</small>
                )}
              </GlassPanel>
            ))}
            {!locked && (
              <button
                className="mechanic-action"
                disabled={
                  busy ||
                  !job.faults.length ||
                  job.faults.some(
                    (f) => !f.completed || !f.beforePhoto || !f.afterPhoto,
                  )
                }
                onClick={() => {
                  triggerHaptic('light');
                  void save('ready');
                }}
              >
                Mark vehicle ready
              </button>
            )}
          </>
        )}
      </GlassPanel>
      {capture && (
        <Capture
          label={capture.label}
          onSave={capture.save}
          onClose={() => setCapture(null)}
        />
      )}
    </>
  );
}
