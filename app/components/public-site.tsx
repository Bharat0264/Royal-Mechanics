'use client';
import { triggerHaptic } from '@/lib/haptics';
import { requestWithMinimum as fetch } from '@/lib/minimum-request';
import { Loader, useMinimumBusy } from './loader';
import { SiteFooterCredit } from './site-footer-credit';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import {
  defaultServices,
  defaultWorkshop,
  defaultSettings,
} from '@/lib/site-defaults';
import {
  ArrowRight,
  Bike,
  CheckCircle2,
  ChevronDown,
  Clock3,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Star,
  Wrench,
} from 'lucide-react';

function useServices() {
  const [catalogue, setCatalogue] = useState(defaultServices);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    fetch('/api/services', { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        if (active && Array.isArray(d.services)) setCatalogue(d.services);
      })
      .catch(() => {});
    return () => {
      active = false;
      controller.abort();
    };
  }, []);
  return catalogue.map(
    (s) =>
      [
        s.name,
        s.description,
        '₹' + s.price.toLocaleString('en-IN'),
        Wrench,
      ] as const,
  );
}
function useSite() {
  const [loading, setLoading] = useMinimumBusy(true);
  const [site, setSite] = useState({
    workshop: defaultWorkshop,
    settings: defaultSettings,
    reviews: [] as {
      _id: string;
      name: string;
      vehicle: string;
      text: string;
      rating: number;
    }[],
  });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    fetch('/api/site', { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        if (active) setSite(d);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [setLoading]);
  return { ...site, loading };
}

export function PublicFooter() {
  return (
    <>
      <footer className="public-footer">
        <Link className="public-brand footer-brand" href="/">
          <Image
            className="brand-crest"
            src="/royal-mechanics-logo-alpha.png"
            width={180}
            height={180}
            sizes="74px"
            alt="Royal Mechanics crest"
          />
          <b>
            ROYAL<small>MECHANICS</small>
          </b>
        </Link>
        <SiteFooterCredit />
      </footer>
      <Link className="mobile-book" href="/book-service">
        Book service <ArrowRight size={15} />
      </Link>
    </>
  );
}

function PageIntro({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <section className="page-intro">
      <p>{eyebrow}</p>
      <h1>{title}</h1>
      <span>{text}</span>
    </section>
  );
}
export function HomePage() {
  const services = useServices();
  return (
    <>
      <main className="public-main">
        <section className="premium-hero">
          <div>
            <p className="kicker">
              <i /> TWO-WHEELER SERVICE
            </p>
            <h1>Ride brilliant.</h1>
            <p>Precision care for every ride.</p>
            <Link className="gloss-button hero-cta" href="/book-service">
              Book service <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-machine" aria-label="Royal Mechanics crest">
            <div className="machine-glow" />
            <Image
              className="hero-crest"
              src="/royal-mechanics-logo-alpha.png"
              width={620}
              height={620}
              sizes="(max-width: 700px) 280px, 410px"
              priority
              alt="Royal Mechanics crest"
            />
          </div>
        </section>
        <section className="trust-strip">
          <span>
            <Bike /> <b>500+</b> Bikes serviced
          </span>
          <span>
            <Star /> <b>4.8</b> Rated
          </span>
          <span>
            <Clock3 /> <b>Same-day</b> Service
          </span>
        </section>
        <section className="home-services">
          <div className="section-label">
            <p>ESSENTIAL CARE</p>
            <h2>Made for the road.</h2>
            <Link href="/services">
              All services <ArrowRight size={15} />
            </Link>
          </div>
          <div className="teaser-grid">
            {services.slice(0, 3).map(([name, desc, price, Icon]) => (
              <Link className="glass-card" href="/services" key={name}>
                <Icon />
                <h3>{name}</h3>
                <p>{desc}</p>
                <b>From {price}</b>
              </Link>
            ))}
          </div>
        </section>
        <section className="quote-strip">
          <Bike className="quote-bike" size={24} strokeWidth={1.6} aria-hidden="true" />
          <blockquote>
            “Precision service, explained in plain language, every time.”
          </blockquote>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}

export function ServicesPage() {
  const services = useServices();
  return (
    <>
      <main className="public-main">
        <PageIntro
          eyebrow="SERVICE MENU"
          title="Care, without compromise."
          text="Clear prices. Expert hands."
        />
        <section className="service-full-grid">
          {services.map(([name, desc, price, Icon]) => (
            <Link
              className="glass-card service-card"
              href={`/book-service?service=${encodeURIComponent(name)}`}
              key={name}
              aria-label={`Book ${name}`}
            >
              <Icon />
              <div>
                <h2>{name}</h2>
                <p>{desc}</p>
              </div>
              <b>From {price}</b>
              <span className="service-card-arrow" aria-hidden="true">
                <ArrowRight size={18} />
              </span>
            </Link>
          ))}
        </section>
      </main>
      <PublicFooter />
    </>
  );
}

export function WorkshopPage() {
  const { workshop } = useSite();
  return (
    <>
      <main className="public-main">
        <PageIntro
          eyebrow="THE WORKSHOP"
          title={workshop.title}
          text={workshop.description}
        />
        <p
          style={{
            maxWidth: 760,
            margin: '0 auto 40px',
            padding: '0 24px',
            color: '#c7bcb3',
            lineHeight: 1.8,
            textAlign: 'center',
          }}
        >
          {workshop.about}
        </p>
        <section className="workshop-visual">
          {workshop.photos.length ? (
            workshop.photos.map((src, i) => (
              <Image
                key={src}
                src={src}
                width={700}
                height={450}
                alt={`Royal Mechanics workshop ${i + 1}`}
                style={{
                  width: '100%',
                  height: 350,
                  objectFit: 'cover',
                  borderRadius: 22,
                }}
              />
            ))
          ) : (
            <>
              <div className="photo-panel">
                <Wrench size={72} />
                <span>PRECISION BAY 01</span>
              </div>
              <div className="photo-panel photo-alt">
                <Bike size={94} />
                <span>READY FOR THE ROAD</span>
              </div>
            </>
          )}
        </section>
        <section className="badge-grid">
          {[
            ['8+', 'Years active'],
            ['100%', 'Genuine parts'],
            ['30-day', 'Service warranty'],
          ].map(([n, label]) => (
            <article className="glass-card" key={label}>
              <ShieldCheck />
              <strong>{n}</strong>
              <span>{label}</span>
            </article>
          ))}
        </section>
      </main>
      <PublicFooter />
    </>
  );
}

export function ReviewsPage() {
  const { reviews, loading } = useSite();
  return (
    <>
      <main className="public-main">
        <PageIntro
          eyebrow="RIDER REVIEWS"
          title="Trusted at every turn."
          text="Real riders. Real results."
        />
        <section className="review-grid">
          {loading ? (
            <Loader size="skeleton" label="Loading reviews" />
          ) : reviews.length ? (
            reviews.map((r) => (
              <article className="glass-card review-card" key={r._id}>
                <span
                  className="stars"
                  aria-label={`${r.rating} out of 5 stars`}
                >
                  {Array.from({ length: r.rating }, (_, i) => (
                    <Star key={i} size={14} fill="currentColor" />
                  ))}
                </span>
                <blockquote>{r.text}</blockquote>
                <b>{r.name}</b>
                <span>{r.vehicle}</span>
              </article>
            ))
          ) : (
            <article className="glass-card review-card">
              <h2>Every ride has a story.</h2>
              <p style={{ color: '#c7bcb3' }}>
                Be the first to share yours. Reviews appear after workshop
                approval.
              </p>
              <Link href="/login" style={{ color: '#ffad53' }}>
                Share your experience <ArrowRight size={14} />
              </Link>
            </article>
          )}
        </section>
      </main>
      <PublicFooter />
    </>
  );
}

export function ContactPage() {
  const { settings } = useSite();
  const [open, setOpen] = useState<number | null>(null);
  const faqs = [
    [
      'How long does a service take?',
      'Most scheduled services are completed the same day.',
    ],
    [
      'Do you use genuine parts?',
      'Yes. We use genuine or approved OEM-quality parts.',
    ],
    [
      'Can I approve repairs online?',
      'Yes. Your service request shows inspection photos and estimates.',
    ],
    [
      'Is pickup and drop available?',
      'Yes, subject to location and slot availability.',
    ],
    [
      'Is there a service warranty?',
      'Every eligible repair receives a 30-day warranty.',
    ],
  ];
  return (
    <>
      <main className="public-main">
        <PageIntro
          eyebrow="FAQ & CONTACT"
          title="Ask. Book. Ride."
          text="We are here when your bike needs us."
        />
        <section className="contact-layout">
          <div className="faq-list">
            {faqs.map(([q, a], index) => (
              <article className={open === index ? 'open' : ''} key={q}>
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    return setOpen(open === index ? null : index);
                  }}
                >
                  {q}
                  <ChevronDown />
                </button>
                {open === index && <p>{a}</p>}
              </article>
            ))}
          </div>
          <form
            className="contact-card glass-card"
            onSubmit={(e) => {
              e.preventDefault();
              triggerHaptic('medium');
              const form = new FormData(e.currentTarget);
              const value = (name: string) => {
                const field = form.get(name);
                return typeof field === 'string' ? field.trim() : '';
              };
              const text = `Hello Royal Mechanics, I am ${value('name')}. Contact: ${value('phone')}. ${value('message')}`;
              window.location.assign(
                `https://wa.me/919182372075?text=${encodeURIComponent(text)}`,
              );
            }}
          >
            <h2>Start a conversation.</h2>
            <input
              name="name"
              required
              placeholder="Your name"
              aria-label="Your name"
            />
            <input
              name="phone"
              required
              type="tel"
              placeholder="Phone number"
              aria-label="Phone number"
            />
            <textarea
              placeholder="How can we help?"
              name="message"
              required
              aria-label="How can we help?"
            />
            <button
              className="gloss-button"
              onClick={() => triggerHaptic('light')}
            >
              Send enquiry <ArrowRight size={15} />
            </button>
          </form>
        </section>
        <section className="visit-card">
          <div>
            <MapPin />
            <h2>Visit the workshop</h2>
            <p>{settings.address}</p>
          </div>
          <div>
            <Clock3 />
            <h2>Hours</h2>
            <p>
              {settings.hours}
              {settings.phone && (
                <>
                  <br />
                  {settings.phone}
                </>
              )}
              {settings.email && (
                <>
                  <br />
                  {settings.email}
                </>
              )}
            </p>
          </div>
          <a
            className="whatsapp"
            href={`https://wa.me/919182372075?text=${encodeURIComponent('Hello Royal Mechanics, I would like to enquire about a service.')}`}
            aria-label="Chat with Royal Mechanics on WhatsApp"
          >
            <MessageCircle /> WhatsApp +91 91823 72075
          </a>
        </section>
        <section className="map-card">
          <iframe
            title="Royal Mechanics location"
            loading="lazy"
            src="https://www.google.com/maps?output=embed&q=Shop+No+07%2C+Plot+No+05%2C+Sai+Raj+Building%2C+Gurudwara+Road%2C+New+Panvel%2C+Navi+Mumbai+410206"
          />
          <a
            className="gloss-button"
            href="https://share.google/yQlVV3cGUfRQSWn2G"
            target="_blank"
            rel="noreferrer"
          >
            Get directions <ArrowRight size={15} />
          </a>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}

export function BookingPage() {
  const services = useServices();
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useMinimumBusy();
  const [status, setStatus] = useState('');
  const submit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    triggerHaptic('medium');
    setStatus('');
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const response = await fetch('/api/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleName: form.get('vehicleName'),
          vehicleNumber: form.get('vehicleNumber'),
          phone: form.get('phone'),
          serviceCategory: form.get('serviceCategory'),
          serviceMode: form.get('serviceMode'),
          preferredSlot: form.get('preferredSlot'),
          notes: form.get('notes'),
        }),
      });
      if (response.ok) {
        triggerHaptic('success');
        setSubmitted(true);
        return;
      }
      triggerHaptic('error');
      const result = await response.json().catch(() => ({}));
      setStatus(
        typeof result.error === 'string'
          ? result.error
          : 'We could not submit your request. Please try again.',
      );
    } catch {
      triggerHaptic('error');
      setStatus('Unable to connect. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <main className="public-main utility-page">
        <section className="booking-intro">
          <div>
            <p className="kicker">
              <i /> SERVICE REQUEST
            </p>
            <h1>
              Set the next ride
              <br />
              in motion.
            </h1>
            <p>
              Choose the care your two-wheeler needs. We will confirm your slot
              before any work begins.
            </p>
          </div>
          <Image
            className="booking-crest"
            src="/royal-mechanics-logo-alpha.png"
            width={320}
            height={320}
            sizes="(max-width: 700px) 105px, 280px"
            priority
            alt="Royal Mechanics crest"
          />
        </section>
        <section className="booking-shell glass-card">
          <div className="booking-aside">
            <span>01</span>
            <h2>Tell us about your ride.</h2>
            <p>
              Share the essentials, then we will confirm availability and
              pricing with you.
            </p>
            <div>
              <Bike />
              <p>
                <b>Transparent updates</b> before work starts.
              </p>
            </div>
            <div>
              <ShieldCheck />
              <p>
                <b>Genuine care</b> for every ride.
              </p>
            </div>
          </div>
          <form className="booking-form" onSubmit={submit} aria-busy={busy}>
            {busy && <Loader size="button" />}
            <div className="form-heading">
              <p className="kicker">BOOK A SERVICE</p>
              <h2>Your booking details.</h2>
            </div>
            <div className="booking-fields">
              <label>
                Contact number{' '}
                <input
                  required
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                />
              </label>
              <label>
                Vehicle{' '}
                <input
                  required
                  name="vehicleName"
                  placeholder="e.g. Honda Activa 6G"
                />
              </label>
              <label>
                Vehicle number{' '}
                <input
                  required
                  name="vehicleNumber"
                  autoCapitalize="characters"
                  maxLength={20}
                  placeholder="e.g. MH 46 AB 1234"
                />
              </label>
              <label>
                Service needed{' '}
                <select required name="serviceCategory" defaultValue="">
                  <option value="" disabled>
                    Select a service
                  </option>
                  {services.map(([name]) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label>
                Service mode{' '}
                <select required name="serviceMode" defaultValue="">
                  <option value="" disabled>
                    Choose pickup or drop-off
                  </option>
                  <option value="SELF_DROP">
                    I’ll drop it at the workshop
                  </option>
                  <option value="PICKUP_DROP">Pickup & drop</option>
                </select>
              </label>
              <label>
                Preferred time{' '}
                <input required name="preferredSlot" type="datetime-local" />
              </label>
              <label className="form-wide">
                Anything we should know?{' '}
                <textarea
                  name="notes"
                  placeholder="A sound, warning light, or preferred appointment time…"
                />
              </label>
            </div>
            <button
              className="gloss-button"
              type="submit"
              disabled={busy}
              onClick={() => triggerHaptic('light')}
            >
              Request service{' '}
              {busy ? <Loader size="button" /> : <ArrowRight size={16} />}
            </button>
            {submitted && (
              <output className="form-success">
                <CheckCircle2 /> Request received. We’ll confirm your slot
                shortly.
              </output>
            )}
            {status && (
              <p className="form-error" role="alert">
                {status}{' '}
                {status.includes('sign in') && (
                  <Link href="/login">Sign in</Link>
                )}
              </p>
            )}
          </form>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
