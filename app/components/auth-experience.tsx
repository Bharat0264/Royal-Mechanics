'use client';
import { triggerHaptic } from '@/lib/haptics';
import { requestWithMinimum as fetch } from '@/lib/minimum-request';
import { Loader, useMinimumBusy } from './loader';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import './auth.css';

type Mode = 'login' | 'signup' | 'forgot' | 'reset' | 'sent' | 'done';
export function AuthExperience({
  initialMode = 'login',
  token = '',
  initialError = '',
  portal = 'customer',
}: {
  initialMode?: Mode;
  token?: string;
  initialError?: string;
  portal?: 'customer' | 'mechanic';
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useMinimumBusy();
  const [error, setError] = useState(initialError);
  const [fields, setFields] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [terms, setTerms] = useState(false);
  const [remember, setRemember] = useState(false);
  const signup = mode === 'signup';
  const passwordMode = signup || mode === 'reset';
  const errors: Record<string, string> = {
    name: fields.name.trim().length < 2 ? 'Please enter your full name.' : '',
    email: /^\S+@\S+\.\S+$/.test(fields.email)
      ? ''
      : 'Enter a valid email address.',
    phone: /^\+?[\d\s()-]{10,20}$/.test(fields.phone)
      ? ''
      : 'Enter a valid phone number.',
    password: passwordMode
      ? fields.password.length >= 10 &&
        /[a-zA-Z]/.test(fields.password) &&
        /[^a-zA-Z]/.test(fields.password)
        ? ''
        : 'Use at least 10 characters, with letters and a number or symbol.'
      : fields.password
        ? ''
        : 'Enter your password.',
    confirm:
      fields.confirm === fields.password ? '' : 'Passwords do not match.',
    terms: terms ? '' : 'Please accept the Terms & Privacy policy.',
  };
  function changeMode(next: Mode) {
    setMode(next);
    setTouched({});
    setError('');
    setVisible(false);
    setFields((v) => ({ ...v, password: '', confirm: '' }));
  }
  const strength = [
    fields.password.length >= 10,
    /[a-z]/.test(fields.password) && /[A-Z]/.test(fields.password),
    /\d/.test(fields.password),
    /[^\w\s]/.test(fields.password),
  ].filter(Boolean).length;
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    triggerHaptic('medium');
    const keys =
      mode === 'forgot'
        ? ['email']
        : mode === 'reset'
          ? ['password', 'confirm']
          : signup
            ? ['name', 'email', 'phone', 'password', 'terms']
            : ['email', 'password'];
    setTouched(Object.fromEntries(keys.map((k) => [k, true])));
    if (keys.some((k) => errors[k])) {
      triggerHaptic('error');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const action =
        mode === 'forgot'
          ? 'forgot-password'
          : mode === 'reset'
            ? 'reset-password'
            : mode;
      const response = await fetch(`/api/auth/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, terms, remember, token }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || 'Something went wrong. Please try again.',
        );
      triggerHaptic('success');
      if (mode === 'forgot') changeMode('sent');
      else if (mode === 'reset') changeMode('done');
      else {
        router.replace(data.redirect);
        router.refresh();
      }
    } catch (e) {
      triggerHaptic('error');
      setError(
        e instanceof Error ? e.message : 'Unable to connect. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  function field(
    key: keyof typeof fields,
    label: string,
    placeholder: string,
    type = 'text',
  ) {
    const password = key === 'password' || key === 'confirm';
    const invalid = touched[key] && errors[key];
    return (
      <div className="auth-field">
        <label htmlFor={`auth-${key}`}>{label}</label>
        <div className={`auth-input ${invalid ? 'invalid' : ''}`}>
          <input
            id={`auth-${key}`}
            name={key}
            type={password ? (visible ? 'text' : 'password') : type}
            value={fields[key]}
            onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
            onBlur={() => setTouched({ ...touched, [key]: true })}
            placeholder={placeholder}
            required
            maxLength={password ? 128 : key === 'name' ? 100 : 254}
            autoComplete={
              key === 'password'
                ? mode === 'login'
                  ? 'current-password'
                  : 'new-password'
                : key === 'confirm'
                  ? 'new-password'
                  : key === 'phone'
                    ? 'tel'
                    : key
            }
            aria-invalid={Boolean(invalid)}
            aria-describedby={invalid ? `${key}-error` : undefined}
          />
          {password && (
            <button
              type="button"
              aria-label={visible ? 'Hide password' : 'Show password'}
              aria-pressed={visible}
              onClick={() => {
                triggerHaptic('light');
                return setVisible(!visible);
              }}
            >
              {visible ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          )}
        </div>
        {invalid && (
          <span className="auth-field-error" id={`${key}-error`}>
            {errors[key]}
          </span>
        )}
      </div>
    );
  }
  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <Link className="auth-wordmark" href="/">
          <Image
            src="/royal-mechanics-logo-alpha.png"
            alt="Royal Mechanics"
            width={54}
            height={54}
          />
          <span>
            ROYAL <small>MECHANICS</small>
          </span>
        </Link>
        <div className="auth-brand-story">
          <p className="auth-eyebrow">
            <span /> PRECISION CARE. LASTING TRUST.
          </p>
          <div className="auth-crest-stage">
            <div className="auth-orbit" />
            <Image
              src="/royal-mechanics-logo-alpha.png"
              width={430}
              height={430}
              priority
              alt="Royal Mechanics golden crest"
            />
          </div>
          <h1>
            Made to endure.
            <br />
            <em>Ride brilliant.</em>
          </h1>
          <p>
            Your ride deserves extraordinary care.
            <br />
            Your journey with us starts here.
          </p>
          <div className="auth-trust">
            <ShieldCheck size={16} /> Expert hands <i /> Transparent care <i />{' '}
            Every mile
          </div>
        </div>
        <div className="auth-brand-bottom">
          <span>THE ROYAL STANDARD</span>
          <span>
            EST. 2018 <Sparkles size={13} />
          </span>
        </div>
      </section>
      <section className="auth-form-panel">
        <Link className="auth-back" href="/">
          <ArrowLeft size={14} /> Back to the workshop
        </Link>
        <div className="auth-card">
          <div className="auth-lock">
            <LockKeyhole size={19} />
          </div>
          {portal === 'customer' && (mode === 'login' || signup) && (
            <div
              className="auth-tabs"
              role="tablist"
              aria-label="Account access"
            >
              <button
                type="button"
                role="tab"
                aria-selected={!signup}
                onClick={() => {
                  triggerHaptic('light');
                  return changeMode('login');
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={signup}
                onClick={() => {
                  triggerHaptic('light');
                  return changeMode('signup');
                }}
              >
                Create account
              </button>
            </div>
          )}
          <div key={mode} className="auth-transition">
            <p className="auth-eyebrow">
              {signup
                ? 'A BETTER JOURNEY STARTS HERE'
                : mode === 'login'
                  ? 'YOUR NEXT CHAPTER'
                  : mode === 'sent'
                    ? 'ONE MORE STEP'
                    : 'SECURE ACCOUNT ACCESS'}
            </p>
            <h2>
              {signup
                ? 'Welcome to the family.'
                : mode === 'login'
                  ? portal === 'mechanic'
                    ? 'Mechanic portal.'
                    : 'Good to see you again.'
                  : mode === 'forgot'
                    ? 'Let’s get you back.'
                    : mode === 'reset'
                      ? 'A fresh start.'
                      : mode === 'sent'
                        ? 'Check your inbox.'
                        : 'You’re ready to ride.'}
            </h2>
            <p className="auth-subtitle">
              {signup
                ? 'Create your account. We’ll take care of the ride.'
                : mode === 'login'
                  ? portal === 'mechanic'
                    ? 'Use the credentials sent by the workshop to access your jobs.'
                    : 'Sign in for a little peace of mind, every mile.'
                  : mode === 'forgot'
                    ? 'Enter your email and we’ll send a password reset link.'
                    : mode === 'reset'
                      ? 'Choose a strong new password for your account.'
                      : mode === 'sent'
                        ? `If an account exists for ${fields.email}, a reset link is on its way. It expires in 30 minutes.`
                        : 'Your password has been updated. Sign in to continue.'}
            </p>
            {(mode === 'login' || signup) && (
              <>
                <button
                  type="button"
                  className="auth-google"
                  onClick={() => {
                    triggerHaptic('light');
                    return window.location.assign('/api/auth/google/start');
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="19"
                    height="19"
                    aria-hidden="true"
                  >
                    <path
                      fill="#4285F4"
                      d="M21.6 12.2c0-.7-.1-1.4-.2-2.2H12v4.1h5.4a4.6 4.6 0 0 1-2 3v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.5Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 22c2.7 0 5-.9 6.7-2.3l-3.3-2.6c-.9.6-2 1-3.4 1a6 6 0 0 1-5.6-4.1H3v2.7A10 10 0 0 0 12 22Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M6.4 14a6 6 0 0 1 0-4V7.3H3a10 10 0 0 0 0 9.4L6.4 14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9 5.3L6.4 10A6 6 0 0 1 12 5.9Z"
                    />
                  </svg>
                  Continue with Google
                </button>
                <div className="auth-divider">
                  <span>or continue with email</span>
                </div>
              </>
            )}
            {mode !== 'sent' && mode !== 'done' ? (
              <form onSubmit={submit} noValidate aria-busy={busy}>
                <fieldset disabled={busy}>
                  {signup && field('name', 'Full name', 'Your full name')}
                  {mode !== 'reset' &&
                    field('email', 'Email address', 'you@example.com', 'email')}
                  {signup &&
                    field('phone', 'Phone number', '+91 98765 43210', 'tel')}
                  {mode !== 'forgot' &&
                    field(
                      'password',
                      mode === 'reset' ? 'New password' : 'Password',
                      'Enter your password',
                    )}
                  {passwordMode && (
                    <div className="auth-strength">
                      <div>
                        {[1, 2, 3, 4].map((n) => (
                          <i key={n} data-active={strength >= n} />
                        ))}
                      </div>
                      <span>
                        {fields.password
                          ? strength < 2
                            ? 'Keep going'
                            : strength < 4
                              ? 'Good password'
                              : 'Strong password'
                          : '10+ characters. Add a number or symbol.'}
                      </span>
                    </div>
                  )}
                  {mode === 'reset' &&
                    field(
                      'confirm',
                      'Confirm password',
                      'Repeat your new password',
                    )}
                  {mode === 'login' && (
                    <div className="auth-options">
                      <label>
                        <input
                          type="checkbox"
                          checked={remember}
                          onChange={(e) => setRemember(e.target.checked)}
                        />{' '}
                        Remember me
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          return changeMode('forgot');
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                  {signup && (
                    <div className="auth-consent">
                      <label>
                        <input
                          type="checkbox"
                          checked={terms}
                          onChange={(e) => setTerms(e.target.checked)}
                        />{' '}
                        <span>
                          I agree to the{' '}
                          <Link href="/terms" target="_blank">
                            Terms
                          </Link>{' '}
                          &{' '}
                          <Link href="/privacy" target="_blank">
                            Privacy Policy
                          </Link>
                          .
                        </span>
                      </label>
                      {touched.terms && errors.terms && (
                        <span className="auth-field-error">{errors.terms}</span>
                      )}
                    </div>
                  )}
                  {error && (
                    <p className="auth-alert" role="alert">
                      {error}
                    </p>
                  )}
                  <button
                    className="auth-submit"
                    type="submit"
                    onClick={() => triggerHaptic('light')}
                  >
                    <span>
                      {busy
                        ? 'One moment…'
                        : signup
                          ? 'Create account'
                          : mode === 'forgot'
                            ? 'Send reset link'
                            : mode === 'reset'
                              ? 'Update password'
                              : 'Sign in to your account'}
                    </span>
                    {busy ? <Loader size="button" /> : <ArrowRight size={18} />}
                  </button>
                </fieldset>
              </form>
            ) : (
              <div className="auth-complete">
                {mode === 'sent' ? (
                  <Mail size={38} />
                ) : (
                  <CheckCircle2 size={38} />
                )}
                <button
                  className="auth-submit"
                  onClick={() => {
                    triggerHaptic('light');
                    return changeMode('login');
                  }}
                >
                  Back to sign in <ArrowRight size={18} />
                </button>
                {mode === 'sent' && (
                  <button
                    className="auth-text-button"
                    onClick={() => {
                      triggerHaptic('light');
                      return changeMode('forgot');
                    }}
                  >
                    Try another email or resend
                  </button>
                )}
              </div>
            )}
            {(mode === 'forgot' || mode === 'reset') && (
              <button
                className="auth-text-button"
                onClick={() => {
                  triggerHaptic('light');
                  return changeMode('login');
                }}
              >
                <ArrowLeft size={13} /> Back to sign in
              </button>
            )}
          </div>
          <div className="auth-card-footer">
            <ShieldCheck size={13} /> Your account. Safely in your hands.
          </div>
        </div>
        <p className="auth-help">
          A little help along the way?{' '}
          <Link href="/contact">
            Talk to us <ArrowRight size={12} />
          </Link>
        </p>
        <p className="auth-copyright">
          <Check size={11} /> ROYAL MECHANICS · CARE BEYOND THE WORKSHOP
        </p>
      </section>
    </main>
  );
}
