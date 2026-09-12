'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
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
    <div>
      <button
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
  const active = jobs.filter(
    (job) => !['COMPLETED', 'CANCELLED'].includes(job.status),
  );
  const statusCount = (status: string) =>
    active.filter((job) => job.status === status).length;
  const statusName = (status: string) => status.replaceAll('_', ' ');
  return (
    <>
      <h1>Job queue</h1>
      <p>{active.length} active vehicles</p>
      <div className="job-summary" aria-label="Job status summary">
        <span data-status="ASSIGNED">Assigned · {statusCount('ASSIGNED')}</span>
        <span data-status="IN_PROGRESS">
          In progress · {statusCount('IN_PROGRESS')}
        </span>
        <span data-status="QUALITY_CHECK">
          Quality check · {statusCount('QUALITY_CHECK')}
        </span>
      </div>
      <div className="job-queue">
        {active.map((job, index) => (
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
            <span>{job.customerId?.displayName || 'Walk-in customer'}</span>
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
      </div>
      {!active.length && (
        <GlassPanel className="job-card">
          No active assignments. Assigned vehicles will appear here.
        </GlassPanel>
      )}
    </>
  );
}
async function preparePhoto(file: File) {
  if (!file.type.startsWith('image/') || file.size > 20_000_000)
    throw new Error('Choose an image smaller than 20 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new window.Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error('Unable to read image. Try JPEG or PNG.'));
      image.src = url;
    });
    const scale = Math.min(1, 1000 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas
      .getContext('2d')!
      .drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.65);
  } finally {
    URL.revokeObjectURL(url);
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
      const results = await Promise.allSettled([
        preparePhoto(file),
        new Promise((resolve) => setTimeout(resolve, 300)),
      ]);
      if (results[0].status === 'rejected') throw results[0].reason;
      const photo = results[0].value;
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
          <p role="status" className="console-message">
            {message}
          </p>
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
