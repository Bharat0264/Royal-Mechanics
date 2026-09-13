'use client';
import { triggerHaptic, useHaptics } from '@/lib/haptics';
import { requestWithMinimum as fetch } from '@/lib/minimum-request';
import { Loader, useMinimumBusy } from './loader';
import Image from 'next/image';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowDownUp,
  ArrowRight,
  Bell,
  Bike,
  Camera,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  LayoutDashboard,
  Images,
  LogOut,
  Menu,
  Plus,
  Power,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Viewer } from '@/lib/auth';
import {
  bookingStatuses,
  defaultSettings,
  defaultWorkshop,
  statusLabel,
} from '@/lib/site-defaults';
import './admin.css';
import { GlassPanel } from './glass-panel';
import { GlassButton } from './glass-button';
import { AdminSidebar } from './admin-sidebar';

type Person = {
  _id: string;
  displayName?: string;
  email: string;
  phone?: string;
  role: string;
  specialties?: string;
  isAllowed: boolean;
};
type Booking = {
  _id: string;
  requestNumber: string;
  customerId?: Person;
  vehicleName: string;
  serviceCategory: string;
  mechanicId?: string;
  mechanicEmail?: string;
  status: string;
  createdAt: string;
  preferredSlot?: string;
  notes?: string;
  estimate?: number;
  estimateApproved?: boolean;
  inspectionPhotos?: string[];
  intakePhotos?: string[];
  faults?: {
    text: string;
    beforePhoto?: string;
    afterPhoto?: string;
    completed?: boolean;
  }[];
};
type Service = {
  _id?: string;
  name: string;
  description: string;
  price: number;
};
type Review = {
  _id: string;
  name: string;
  vehicle: string;
  text: string;
  rating: number;
  approved: boolean;
  createdAt: string;
};
type Data = {
  bookings: Booking[];
  users: Person[];
  services: Service[];
  reviews: Review[];
  invoices: {
    _id: string;
    bookingId?: string;
    invoiceNumber?: string;
    vehicleName?: string;
    total: number;
    updatedAt: string;
    paymentStatus?: string;
    paymentMethod?: string;
    customerName?: string;
  }[];
  workshop: typeof defaultWorkshop;
  settings: typeof defaultSettings;
};
type Values = Record<string, string | number | boolean | string[]>;
type Editor = { section: string; id?: string; title: string; values: Values };
type MechanicCredentials = { id: string; email: string; password: string };
const nav = [
  ['overview', 'Dashboard', LayoutDashboard],
  ['bookings', 'Bookings', CalendarDays],
  ['customers', 'Customers', Users],
  ['staff', 'Mechanics', Wrench],
  ['services', 'Services & pricing', SlidersHorizontal],
  ['reviews', 'Reviews', Star],
  ['billing', 'Billing', CircleDollarSign],
  ['workshop', 'Workshop & content', Bike],
  ['settings', 'Settings', Settings],
] as const;
const money = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
const date = (s: string) =>
  new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

function GaugeKpi({
  Icon,
  label,
  value,
  caption,
  progress,
  alert = false,
}: {
  Icon: typeof CalendarDays;
  label: string;
  value: string | number;
  caption: string;
  progress: number;
  alert?: boolean;
}) {
  const safeProgress = Math.min(100, Math.max(0, progress));
  const style = {
    '--gauge-offset': String(251 - (251 * safeProgress) / 100),
    '--needle-turn': `${safeProgress * 3.6}deg`,
    '--gauge-color': '#e8b84b',
    '--needle-opacity': safeProgress > 0 ? '1' : '0',
  } as CSSProperties;
  return (
    <GlassPanel className={`admin-widget admin-kpi ${alert ? 'is-alert' : ''}`}>
      <span className="admin-kpi-label">{label}</span>
      <div className="admin-gauge" style={style}>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className="admin-gauge-track" cx="50" cy="50" r="40" />
          <circle
            className="admin-gauge-value"
            cx="50"
            cy="50"
            r="40"
          />
        </svg>
        <i className="admin-gauge-needle" />
        <span className="admin-gauge-hub"><Icon aria-hidden="true" /></span>
      </div>
      <div className="admin-kpi-copy">
        <strong>{value}</strong>
        <small>{caption}</small>
      </div>
    </GlassPanel>
  );
}
export function AdminPortal({
  viewer,
  section,
}: {
  viewer: Viewer;
  section: string;
}) {
  const guest = viewer.isGuest;
  const { isHapticsEnabled, isReducedMotion, toggleHaptics } = useHaptics();
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mechanicCredentials, setMechanicCredentials] =
    useState<MechanicCredentials | null>(null);
  const [loading, setLoading] = useMinimumBusy(true);
  const [busy, setBusy] = useMinimumBusy();
  const [mobile, setMobile] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const topbarRef = useRef<HTMLElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [ascending, setAscending] = useState(false);
  const [period, setPeriod] = useState('week');
  const [popover, setPopover] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [shopLights, setShopLights] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin');
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setData(result);
    } catch (e) {
      triggerHaptic('error');
      setError(e instanceof Error ? e.message : 'Unable to load data.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (editor) dialog.current?.showModal();
    else dialog.current?.close();
  }, [editor]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!popover) return;
    const closeOnOutsideTap = (event: PointerEvent) => {
      const target = event.target as Node;
      const anchor = popover === 'profile' ? profileRef.current : topbarRef.current;
      if (!anchor?.contains(target)) setPopover('');
    };
    document.addEventListener('pointerdown', closeOnOutsideTap);
    return () => document.removeEventListener('pointerdown', closeOnOutsideTap);
  }, [popover]);
  async function signout() {
    await fetch('/api/auth/signout', { method: 'POST' });
    router.replace('/');
    router.refresh();
  }
  async function save(
    section: string,
    values: Values,
    id?: string,
    action = 'save',
  ) {
    if (guest) {
      setNotice('Sign in to do this. Guest view never saves changes.');
      return;
    }
    triggerHaptic('medium');
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        section === 'billing'
          ? '/api/bills'
          : section === 'createMechanic'
            ? '/api/mechanics'
            : '/api/admin',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            section === 'billing'
              ? {
                  bookingId: values.bookingId,
                  taxRate: Number(values.taxRate || 0),
                  items: [
                    {
                      name: values.serviceName,
                      quantity: 1,
                      unitPrice: Number(values.servicePrice || 0),
                    },
                    ...(Number(values.partsPrice || 0) > 0
                      ? [
                          {
                            name: 'Parts used',
                            quantity: 1,
                            unitPrice: Number(values.partsPrice),
                          },
                        ]
                      : []),
                    ...(Number(values.laborPrice || 0) > 0
                      ? [
                          {
                            name: 'Labour',
                            quantity: 1,
                            unitPrice: Number(values.laborPrice),
                          },
                        ]
                      : []),
                    ...(Number(values.extraPrice || 0) > 0
                      ? [
                          {
                            name: 'Extra charges',
                            quantity: 1,
                            unitPrice: Number(values.extraPrice),
                          },
                        ]
                      : []),
                  ],
                }
              : section === 'createMechanic'
                ? values
                : { section, id, action, data: values },
          ),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      triggerHaptic('success');
      setEditor(null);
      if (
        section === 'createMechanic' &&
        result.invitationDelivered === false &&
        typeof result.userId === 'string' &&
        typeof result.email === 'string' &&
        typeof result.temporaryPassword === 'string'
      ) {
        setMechanicCredentials({
          id: result.userId,
          email: result.email,
          password: result.temporaryPassword,
        });
      }
      setNotice(
        section === 'createMechanic'
          ? result.invitationDelivered === false
            ? 'Mechanic added. Email delivery is pending; copy the temporary credentials.'
            : 'Mechanic added successfully. Login credentials have been emailed.'
          : action === 'delete'
            ? 'Service removed from the public menu.'
            : 'Changes saved successfully.',
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
      triggerHaptic('error');
    } finally {
      setBusy(false);
    }
  }
  const matches = (...values: unknown[]) =>
    values.join(' ').toLowerCase().includes(query.toLowerCase());
  const bookings = (data?.bookings || [])
    .filter(
      (b) =>
        matches(
          b.requestNumber,
          b.vehicleName,
          b.customerId?.displayName,
          b.customerId?.email,
          b.serviceCategory,
          b.mechanicEmail,
        ) &&
        (filter === 'all' || b.status === filter),
    )
    .sort((a, b) =>
      ascending
        ? a.createdAt.localeCompare(b.createdAt)
        : b.createdAt.localeCompare(a.createdAt),
    );
  const customers = (data?.users || []).filter(
    (p) => p.role === 'CUSTOMER' && matches(p.displayName, p.email, p.phone),
  );
  const mechanics = (data?.users || []).filter(
    (p) =>
      p.role === 'MECHANIC' && matches(p.displayName, p.email, p.specialties),
  );
  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata',
  });
  const isToday = (s: string) =>
    new Date(s).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) ===
    today;
  const [now] = useState(() => Date.now());
  const revenue = (data?.invoices || [])
    .filter(
      (i) =>
        now - new Date(i.updatedAt).getTime() <
        (period === 'day' ? 1 : period === 'week' ? 7 : 30) * 86400000,
    )
    .reduce((sum, i) => sum + i.total, 0);
  const active = (data?.bookings || []).filter(
    (b) => !['COMPLETED', 'CANCELLED'].includes(b.status),
  );
  const approvedReviews = data?.reviews.filter((r) => r.approved) || [];
  const rating = approvedReviews.length
    ? (
        approvedReviews.reduce((s, r) => s + r.rating, 0) /
        approvedReviews.length
      ).toFixed(1)
    : '—';
  const activity = [
    ...(data?.bookings || []).map((b) => ({
      id: b._id,
      title: `${b.requestNumber} · ${statusLabel(b.status)}`,
      detail: `${b.customerId?.displayName || 'Customer'} · ${b.serviceCategory}`,
      time: b.createdAt,
    })),
    ...(data?.reviews || []).map((r) => ({
      id: r._id,
      title: `New ${r.rating}-star review`,
      detail: r.name,
      time: r.createdAt,
    })),
  ]
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 7);
  const trend = Array.from(
    { length: period === 'month' ? 30 : period === 'day' ? 1 : 7 },
    (_, i) => {
      const d = new Date();
      d.setDate(
        d.getDate() -
          ((period === 'month' ? 30 : period === 'day' ? 1 : 7) - 1 - i),
      );
      const day = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      return {
        day: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        revenue: (data?.invoices || [])
          .filter(
            (x) =>
              new Date(x.updatedAt).toLocaleDateString('en-CA', {
                timeZone: 'Asia/Kolkata',
              }) === day,
          )
          .reduce((s, x) => s + x.total, 0),
        bookings: (data?.bookings || []).filter(
          (x) =>
            new Date(x.createdAt).toLocaleDateString('en-CA', {
              timeZone: 'Asia/Kolkata',
            }) === day,
        ).length,
      };
    },
  );
  const pendingReviews = data?.reviews.filter((r) => !r.approved).length || 0;
  const completedCounts = (mechanicId: string) => {
    const completed = (data?.bookings || []).filter(
      (booking) => booking.mechanicId === mechanicId && booking.status === 'COMPLETED',
    );
    const countSince = (days: number) => completed.filter(
      (booking) => now - new Date(booking.createdAt).getTime() < days * 86400000,
    ).length;
    return { day: countSince(1), week: countSince(7), month: countSince(30), lifetime: completed.length };
  };
  function bookingEditor(b: Booking) {
    setEditor({
      section: 'bookings',
      id: b._id,
      title: b.requestNumber,
      values: {
        status: b.status,
        mechanicId: b.mechanicId || '',
        estimate: b.estimate || 0,
        estimateApproved: b.estimateApproved || false,
        notes: b.notes || '',
        inspectionPhotos: b.inspectionPhotos || [],
        bookingId: b._id,
        vehicleName: b.vehicleName,
        serviceCategory: b.serviceCategory,
      },
    });
  }
  const empty = (label: string) => (
    <div className="admin-empty">
      <Sparkles size={25} />
      <h3>{query ? 'No matching results' : label}</h3>
      <p>
        {query
          ? 'Try a different search or filter.'
          : 'New records will appear here as your workshop gets moving.'}
      </p>
    </div>
  );
  function bookingTable(rows: Booking[]) {
    return rows.length ? (
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Booking / customer</th>
              <th>Vehicle & service</th>
              <th>Mechanic</th>
              <th>Status</th>
              <th>
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    return setAscending(!ascending);
                  }}
                >
                  Date <ArrowDownUp size={12} />
                </button>
              </th>
              <th>
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b._id}>
                <td>
                  <button
                    className="admin-record"
                    onClick={() => {
                      triggerHaptic('light');
                      return bookingEditor(b);
                    }}
                  >
                    {b.customerId?.displayName || 'Customer'}
                  </button>
                  <small>{b.requestNumber}</small>
                </td>
                <td>
                  {b.vehicleName}
                  <small>{b.serviceCategory}</small>
                </td>
                <td>
                  {data?.users.find((u) => u._id === b.mechanicId)
                    ?.displayName ||
                    b.mechanicEmail || (
                      <span className="admin-muted">Unassigned</span>
                    )}
                </td>
                <td>
                  <span className={`admin-status status-${b.status}`}>
                    {statusLabel(b.status)}
                  </span>
                </td>
                <td>{date(b.createdAt)}</td>
                <td>
                  <button
                    className="admin-icon"
                    aria-label={`View ${b.requestNumber}`}
                    onClick={() => {
                      triggerHaptic('light');
                      return bookingEditor(b);
                    }}
                  >
                    <ArrowRight size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      empty('No bookings yet')
    );
  }
  return (
    <div
      className={`admin-shell ${mobile ? 'mobile-open' : ''} ${shopLights ? 'lights-on' : ''}`}
      onClickCapture={(event) => {
        if (!guest) return;
        const action = (event.target as HTMLElement).closest('button, a');
        if (!action || action.textContent?.includes('Sign out')) return;
        event.preventDefault();
        event.stopPropagation();
        setNotice('Sign in to do this. Guest view never saves changes.');
      }}
    >
      {guest && (
        <output className="guest-banner">
          Viewing as Guest · Sign in for full access
        </output>
      )}
      <AdminSidebar onClose={() => setMobile(false)}>
        <nav aria-label="Admin navigation">
          {nav.map(([id, label, Icon]) => (
            <Link
              key={id}
              aria-label={label}
              data-tooltip={label}
              className={section === id ? 'active' : ''}
              aria-current={section === id ? 'page' : undefined}
              href={
                id === 'overview'
                  ? '/admin'
                  : id === 'staff'
                    ? '/admin/mechanics'
                    : `/admin/${id}`
              }
              onClick={() => setMobile(false)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === 'reviews' && pendingReviews > 0 && (
                <b>{pendingReviews}</b>
              )}
            </Link>
          ))}
        </nav>
      </AdminSidebar>
      {mobile && (
        <button
          className="admin-backdrop"
          aria-label="Close navigation"
          onClick={() => {
            triggerHaptic('light');
            return setMobile(false);
          }}
        />
      )}
      <div className="admin-workspace">
        <header ref={topbarRef} className={`admin-topbar ${mobileSearchOpen ? 'mobile-search-open' : ''}`}>
          <div className="admin-topbar-controls">
          <Link className="admin-mobile-brand" href="/admin" aria-label="Royal Mechanics admin dashboard">
            <Image src="/royal-mechanics-logo-alpha.png" alt="" width={34} height={34} sizes="34px" unoptimized priority />
          </Link>
          <button
            className="admin-menu admin-icon"
            aria-label="Toggle navigation"
            onClick={() => {
              triggerHaptic('light');
              return setMobile(!mobile);
            }}
          >
            <Menu size={20} />
          </button>
          <div className="admin-global-search-wrap">
            <label className="admin-global-search">
              <Search size={15} />
              <input
                aria-label="Search workshop"
                placeholder="Search anything…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <button
              className="admin-mobile-search-close"
              type="button"
              aria-label="Close search"
              onClick={() => setMobileSearchOpen(false)}
            >
              <X size={16} />
            </button>
            {query && data && (
              <div className="admin-search-results" aria-label="Search results">
                <b>Across your workshop</b>
                {nav
                  .filter(([, label]) => matches(label))
                  .map(([id, label]) => (
                    <Link
                      key={id}
                      href={id === 'overview' ? '/admin' : `/admin/${id}`}
                    >
                      {label}
                      <ArrowRight size={12} />
                    </Link>
                  ))}
                {data.bookings
                  .filter((b) =>
                    matches(
                      b.requestNumber,
                      b.vehicleName,
                      b.customerId?.displayName,
                    ),
                  )
                  .slice(0, 4)
                  .map((b) => (
                    <button
                      key={b._id}
                      onClick={() => {
                        triggerHaptic('light');
                        bookingEditor(b);
                        setQuery('');
                      }}
                    >
                      {b.requestNumber}
                      <small>{b.vehicleName}</small>
                    </button>
                  ))}
                {data.users
                  .filter((u) => matches(u.displayName, u.email))
                  .slice(0, 3)
                  .map((u) => (
                    <Link
                      key={u._id}
                      href={
                        u.role === 'MECHANIC'
                          ? '/admin/staff'
                          : '/admin/customers'
                      }
                    >
                      {u.displayName || u.email}
                      <small>{u.role.toLowerCase()}</small>
                    </Link>
                  ))}
                {data.services
                  .filter((s) => matches(s.name))
                  .slice(0, 3)
                  .map((s) => (
                    <button
                      key={s.name}
                      onClick={() => {
                        triggerHaptic('light');
                        setEditor({
                          section: 'services',
                          id: s._id,
                          title: 'Edit service',
                          values: {
                            name: s.name,
                            description: s.description,
                            originalName: s.name,
                            price: s.price,
                          },
                        });
                        setQuery('');
                      }}
                    >
                      {s.name}
                      <small>{money(s.price)}</small>
                    </button>
                  ))}
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    return setQuery('');
                  }}
                >
                  Clear search <X size={12} />
                </button>
              </div>
            )}
          </div>
          <button
            className="admin-mobile-search-toggle admin-icon"
            type="button"
            aria-label="Open search"
            aria-expanded={mobileSearchOpen}
            onClick={() => setMobileSearchOpen(true)}
          >
            <Search size={18} />
          </button>
          <div className="admin-popover-anchor">
            <button
              className={`admin-ignition ${shopLights ? 'is-on' : ''}`}
              type="button"
              aria-label={shopLights ? 'Dim workshop lights' : 'Turn workshop lights on'}
              aria-pressed={shopLights}
              onClick={() => {
                triggerHaptic('medium');
                // A functional update makes rapid dark → light → dark taps
                // deterministic; the shell can only ever have one theme class.
                return setShopLights((isLight) => !isLight);
              }}
            >
              <Power size={15} />
              <i aria-hidden="true" />
            </button>
          </div>
          <div className="admin-popover-anchor">
            <button
              className="admin-icon notification-bell"
              aria-label="Notifications"
              aria-expanded={popover === 'notifications'}
              onClick={() => {
                triggerHaptic('light');
                return setPopover(popover ? '' : 'notifications');
              }}
            >
              <Bell size={18} />
              {pendingReviews > 0 && <i />}
            </button>
            {popover === 'notifications' && (
              <div className="admin-popover">
                <b>Workshop updates</b>
                <p>
                  {data?.settings.notifyReviews === false
                    ? 'Review notifications are paused.'
                    : `${pendingReviews} reviews awaiting approval.`}
                </p>
                <p>
                  {data?.settings.notifyBookings === false
                    ? 'Booking notifications are paused.'
                    : `${active.length} active bookings.`}
                </p>
                <Link href="/admin/reviews">
                  Review queue <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </div>
          <div className="admin-popover-anchor" ref={profileRef}>
            <button
              className="admin-profile"
              onClick={() => {
                triggerHaptic('light');
                return setPopover(popover ? '' : 'profile');
              }}
              aria-expanded={popover === 'profile'}
            >
              <span className="admin-avatar">
                {(viewer.displayName || viewer.email).slice(0, 2).toUpperCase()}
              </span>
              <span>
                {viewer.displayName || 'Administrator'}
                <small>Administrator</small>
              </span>
              <ChevronDown size={13} />
            </button>
            {popover === 'profile' && (
              <div className="admin-popover admin-profile-popover">
                <b>{viewer.email}</b>
                <p className="admin-profile-role">Administrator</p>
                <Link href="/admin/settings">Account settings</Link>
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    return signout();
                  }}
                >
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            )}
          </div>
          </div>
          <span className="admin-breadcrumb">
            Workspace <span>/</span>{' '}
            <b>{nav.find((n) => n[0] === section)?.[1]}</b>
          </span>
        </header>
        <main className="admin-main" key={section}>
          <div className="admin-title-row">
            <div>
              <p className="admin-eyebrow">ROYAL MECHANICS / COMMAND CENTRE</p>
              <h1>
                {section === 'overview'
                  ? 'The workshop, at a glance.'
                  : nav.find((n) => n[0] === section)?.[1]}
              </h1>
              <p className="admin-muted">
                {section === 'overview'
                  ? 'A clear view. A better day. Let’s keep things moving.'
                  : section === 'bookings'
                    ? 'Every ride, from arrival to the road.'
                    : section === 'customers'
                      ? 'The riders who put their trust in you.'
                      : section === 'staff'
                        ? 'Expert hands behind every brilliant ride.'
                        : section === 'services'
                          ? 'Thoughtful care. Transparent pricing.'
                          : section === 'reviews'
                            ? 'Listen, review, and let your work speak.'
                            : section === 'workshop'
                              ? 'Tell the story behind the care.'
                              : 'The details that keep your workshop running.'}
              </p>
            </div>
            <span className="admin-date">
              <CalendarDays size={14} />
              {new Date().toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
          {notice && (
            <output className="admin-toast">
              <Check size={16} />
              {notice}
            </output>
          )}
          {mechanicCredentials && (
            <aside className="admin-credentials" role="alert">
              <div>
                <p className="admin-eyebrow">EMAIL DELIVERY PENDING</p>
                <strong>Share these one-time credentials securely.</strong>
                <span>Email: <code>{mechanicCredentials.email}</code></span>
                <span>Temporary password: <code>{mechanicCredentials.password}</code></span>
              </div>
              <div>
                <button
                  className="admin-secondary"
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(
                      `Royal Mechanics mechanic portal\nEmail: ${mechanicCredentials.email}\nTemporary password: ${mechanicCredentials.password}`,
                    );
                    setNotice('Temporary credentials copied.');
                  }}
                >
                  Copy credentials
                </button>
                <button
                  className="admin-secondary"
                  type="button"
                  onClick={async () => {
                    const response = await fetch(
                      `/api/mechanics/${mechanicCredentials.id}/resend`,
                      { method: 'POST' },
                    );
                    const result = await response.json();
                    if (response.ok) {
                      triggerHaptic('success');
                      setNotice('Invitation email sent successfully.');
                      setMechanicCredentials(null);
                    } else {
                      triggerHaptic('error');
                      setNotice(result.error || 'Unable to resend the invitation.');
                    }
                  }}
                >
                  Resend invite
                </button>
                <button
                  className="admin-icon"
                  type="button"
                  aria-label="Hide temporary credentials"
                  onClick={() => setMechanicCredentials(null)}
                >
                  <X size={16} />
                </button>
              </div>
            </aside>
          )}
          {error && !editor && (
            <div className="admin-error" role="alert">
              {error}
              <button
                onClick={() => {
                  triggerHaptic('light');
                  return void load();
                }}
              >
                Try again
              </button>
            </div>
          )}
          {loading && !data ? (
            <div className="admin-loading">
              <div
                className="admin-speedometer-loader"
                role="status"
                aria-label="Loading workshop data"
              >
                <i />
              </div>
            </div>
          ) : (
            data && (
              <>
                {section === 'overview' && (
                  <>
                    <div className="admin-kpis">
                      {[
                        [
                          CalendarDays,
                          'Today’s bookings',
                          data.bookings.filter((b) => isToday(b.createdAt))
                            .length,
                          'Scheduled today',
                          Math.min(100, data.bookings.filter((b) => isToday(b.createdAt)).length * 20),
                          false,
                        ],
                        [
                          Wrench,
                          'Active jobs',
                          active.length,
                          'In the workshop',
                          Math.min(100, active.length * 16),
                          false,
                        ],
                        [
                          CircleDollarSign,
                          'Revenue',
                          money(revenue),
                          `Paid · this ${period}`,
                          Math.min(100, (revenue / 100000) * 100),
                          false,
                        ],
                        [
                          Star,
                          'Average rating',
                          rating,
                          `${approvedReviews.length} approved reviews`,
                          Number(rating) * 20,
                          false,
                        ],
                        [
                          Clock3,
                          'Pending approvals',
                          data.bookings.filter(
                            (b) => b.status === 'AWAITING_APPROVAL',
                          ).length,
                          'Estimates to review',
                          Math.min(100, data.bookings.filter((b) => b.status === 'AWAITING_APPROVAL').length * 25),
                          data.bookings.some((b) => b.status === 'AWAITING_APPROVAL'),
                        ],
                      ].map(([Icon, label, value, caption, progress, alert]) => {
                        const Glyph = Icon as typeof CalendarDays;
                        return (
                          <GaugeKpi
                            key={String(label)}
                            Icon={Glyph}
                            label={String(label)}
                            value={String(value)}
                            caption={String(caption)}
                            progress={Number(progress)}
                            alert={Boolean(alert)}
                          />
                        );
                      })}
                    </div>
                    <div className="admin-overview-grid">
                      <GlassPanel className="admin-widget admin-chart">
                        <div className="admin-widget-heading">
                          <div>
                            <h2>Momentum, measured.</h2>
                            <p>Revenue & bookings</p>
                          </div>
                          <div className="admin-period-tabs" role="tablist" aria-label="Chart period">
                            {[
                              ['day', 'Today'],
                              ['week', 'Week'],
                              ['month', 'Month'],
                            ].map(([id, name]) => (
                              <GlassButton
                                key={id}
                                type="button"
                                role="tab"
                                aria-selected={period === id}
                                className={period === id ? 'is-active' : ''}
                                onClick={() => {
                                  triggerHaptic('light');
                                  setPeriod(id);
                                }}
                              >
                                {name}
                              </GlassButton>
                            ))}
                          </div>
                        </div>
                        <div className="admin-chart-legend">
                          <span>
                            <i /> Revenue (₹)
                          </span>
                          <span>
                            <i /> Bookings
                          </span>
                        </div>
                        <div
                          style={{ width: '100%', height: 245, minWidth: 0 }}
                        >
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={trend}
                              margin={{
                                left: -18,
                                right: 4,
                                top: 15,
                                bottom: 0,
                              }}
                            >
                              <defs>
                                <linearGradient
                                  id="revenue-gold"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="0%"
                                    stopColor="#cfab64"
                                    stopOpacity={0.28}
                                  />
                                  <stop
                                    offset="100%"
                                    stopColor="#cfab64"
                                    stopOpacity={0}
                                  />
                                </linearGradient>
                              </defs>
                              <CartesianGrid
                                vertical={false}
                                stroke="#ffffff09"
                              />
                              <XAxis
                                dataKey="day"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#777f78', fontSize: 9 }}
                                minTickGap={25}
                              />
                              <YAxis
                                yAxisId="money"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#777f78', fontSize: 9 }}
                              />
                              <YAxis
                                yAxisId="count"
                                orientation="right"
                                hide
                                allowDecimals={false}
                              />
                              <Tooltip
                                contentStyle={{
                                  background: '#191c1d',
                                  border: '1px solid #b9945340',
                                  borderRadius: 10,
                                  fontSize: 11,
                                }}
                              />
                              <Area
                                yAxisId="money"
                                type="monotone"
                                dataKey="revenue"
                                name="Revenue (₹)"
                                stroke="#d5ae67"
                                strokeWidth={2}
                                fill="url(#revenue-gold)"
                              />
                              <Area
                                yAxisId="count"
                                type="monotone"
                                dataKey="bookings"
                                name="Bookings"
                                stroke="#e8b84b"
                                strokeOpacity={0.58}
                                strokeWidth={2}
                                fill="transparent"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </GlassPanel>
                      <GlassPanel className="admin-widget admin-activity">
                        <div className="admin-widget-heading">
                          <h2>Recent activity</h2>
                          <Activity size={17} />
                        </div>
                        {activity.length
                          ? activity.map((a) => (
                              <div className="admin-activity-item" key={a.id}>
                                <span>
                                  <Check size={11} />
                                </span>
                                <div>
                                  <strong>{a.title}</strong>
                                  <p>{a.detail}</p>
                                  <small>{date(a.time)}</small>
                                </div>
                              </div>
                            ))
                          : empty('A fresh page')}
                      </GlassPanel>
                    </div>
                    <GlassPanel className="admin-widget">
                      <div className="admin-widget-heading">
                        <div>
                          <h2>Recent bookings</h2>
                          <p>A little attention goes a long way.</p>
                        </div>
                        <Link href="/admin/bookings">
                          View all <ArrowRight size={13} />
                        </Link>
                      </div>
                      {bookingTable(bookings.slice(0, 5))}
                    </GlassPanel>
                  </>
                )}
                {section === 'bookings' && (
                  <GlassPanel className="admin-widget">
                    <div className="admin-toolbar">
                      <h2>
                        All bookings <span>{bookings.length}</span>
                      </h2>
                      <button
                        className="admin-gold"
                        onClick={() => {
                          triggerHaptic('light');
                          return setEditor({
                            section: 'walkin',
                            title: 'Create walk-in booking',
                            values: {
                              customerName: '',
                              phone: '',
                              email: '',
                              vehicleName: '',
                              serviceCategory: '',
                              notes: '',
                            },
                          });
                        }}
                      >
                        <Plus size={15} /> Create booking
                      </button>
                      <select
                        aria-label="Filter booking status"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        <option value="all">All statuses</option>
                        {bookingStatuses.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(s)}
                          </option>
                        ))}
                      </select>
                    </div>
                    {bookingTable(bookings)}
                  </GlassPanel>
                )}
                {section === 'customers' && (
                  <GlassPanel className="admin-widget">
                    <div className="admin-widget-heading">
                      <h2>
                        Your customers <span>{customers.length}</span>
                      </h2>
                    </div>
                    {customers.length ? (
                      <div className="admin-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Customer</th>
                              <th>Contact</th>
                              <th>Vehicles</th>
                              <th>Service history</th>
                              <th>
                                <span className="sr-only">Actions</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {customers.map((p) => {
                              const history = data.bookings.filter(
                                (b) => b.customerId?._id === p._id,
                              );
                              return (
                                <tr key={p._id}>
                                  <td>
                                    {p.displayName || 'Rider'}
                                    <small>{p.email}</small>
                                  </td>
                                  <td>{p.phone || 'Not provided'}</td>
                                  <td>
                                    {[
                                      ...new Set(
                                        history.map((b) => b.vehicleName),
                                      ),
                                    ].join(', ') || 'No vehicles yet'}
                                  </td>
                                  <td>
                                    {history.length} visits
                                    <small>
                                      {
                                        history.filter(
                                          (b) => b.status === 'COMPLETED',
                                        ).length
                                      }{' '}
                                      completed
                                    </small>
                                  </td>
                                  <td>
                                    <button
                                      className="admin-record"
                                      onClick={() => {
                                        triggerHaptic('light');
                                        return setEditor({
                                          section: 'customer',
                                          id: p._id,
                                          title: p.displayName || 'Customer',
                                          values: {},
                                        });
                                      }}
                                    >
                                      View history
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      empty('Your riders will appear here')
                    )}
                  </GlassPanel>
                )}
                {section === 'staff' && (
                  <>
                    <div className="admin-section-actions">
                      <p className="admin-muted">
                        {mechanics.length} mechanics · {active.length} active
                        assignments
                      </p>
                      <button
                        className="admin-gold"
                        onClick={() => {
                          triggerHaptic('light');
                          return setEditor({
                            section: 'createMechanic',
                            title: 'Add a mechanic',
                            values: {
                              name: '', email: '', phone: '', specialty: '',
                            },
                          });
                        }}
                      >
                        <Plus size={15} /> Add mechanic
                      </button>
                    </div>
                    <GlassPanel className="admin-widget"><div className="admin-table-wrap"><table>
                      <thead><tr><th>Mechanic</th><th>Specialties</th><th>Active vehicles</th><th>Completed jobs</th><th>Access</th><th>Actions</th></tr></thead>
                      <tbody>{mechanics.map(p=>{const counts=completedCounts(p._id);return <tr key={p._id}><td>{p.displayName || 'Mechanic'}<small>{p.email}</small></td><td>{p.specialties || 'General servicing'}</td><td>{active.filter(b=>b.mechanicId===p._id).map(b=><button key={b._id} className="admin-record" onClick={()=>{triggerHaptic('light');bookingEditor(b);}}>{b.vehicleName} · {statusLabel(b.status)}</button>)}</td><td><strong>{counts.lifetime}</strong><small>Today {counts.day} · Week {counts.week} · Month {counts.month} · Lifetime {counts.lifetime}</small></td><td>{p.isAllowed?'Enabled':'Disabled'}</td><td><button className="admin-secondary" onClick={()=>{triggerHaptic('light');setEditor({section:'staff',id:p._id,title:'Mechanic profile',values:{displayName:p.displayName||'',specialties:p.specialties||'',isAllowed:p.isAllowed}});}}>Edit profile</button></td></tr>})}</tbody>
                    </table></div></GlassPanel>
                    {!mechanics.length && empty('Build your workshop team')}
                  </>
                )}
                {section === 'services' && (
                  <GlassPanel className="admin-widget">
                    <div className="admin-widget-heading">
                      <div>
                        <h2>Service menu</h2>
                        <p>Saved changes appear on the public Services page.</p>
                      </div>
                      <button
                        className="admin-gold"
                        onClick={() => {
                          triggerHaptic('light');
                          return setEditor({
                            section: 'services',
                            title: 'Add service',
                            values: { name: '', description: '', price: 0 },
                          });
                        }}
                      >
                        <Plus size={14} /> Add service
                      </button>
                    </div>
                    <div className="admin-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Service</th>
                            <th>Description</th>
                            <th>Starting price</th>
                            <th>
                              <span className="sr-only">Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.services
                            .filter((s) => matches(s.name, s.description))
                            .map((s) => (
                              <tr key={s._id || s.name}>
                                <td>
                                  <Wrench
                                    size={14}
                                    className="admin-inline-icon"
                                  />
                                  {s.name}
                                </td>
                                <td>{s.description}</td>
                                <td className="admin-gold-text">
                                  {money(s.price)}
                                </td>
                                <td>
                                  <button
                                    className="admin-record"
                                    onClick={() => {
                                      triggerHaptic('light');
                                      return setEditor({
                                        section: 'services',
                                        id: s._id,
                                        title: 'Edit service',
                                        values: {
                                          name: s.name,
                                          description: s.description,
                                          originalName: s.name,
                                          price: s.price,
                                        },
                                      });
                                    }}
                                  >
                                    Edit <ArrowRight size={12} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </GlassPanel>
                )}
                {section === 'billing' && (
                  <GlassPanel className="admin-widget">
                    <div className="admin-widget-heading">
                      <div>
                        <h2>Billing control</h2>
                        <p>
                          Issued bills, in-person collections, and customer
                          payments.
                        </p>
                      </div>
                      <CircleDollarSign size={18} />
                    </div>
                    {data.invoices.length ? (
                      <div className="admin-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Bill</th>
                              <th>Customer / vehicle</th>
                              <th>Amount</th>
                              <th>Payment</th>
                              <th>Updated</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.invoices.map((bill) => (
                              <tr key={bill._id}>
                                <td>
                                  {bill.invoiceNumber || 'Royal Mechanics bill'}
                                </td>
                                <td>
                                  {bill.customerName || 'Customer'}
                                  <small>{bill.vehicleName}</small>
                                </td>
                                <td>{money(bill.total)}</td>
                                <td>
                                  <span
                                    className={`admin-status ${bill.paymentStatus === 'PAID' ? 'status-COMPLETED' : ''}`}
                                  >
                                    {bill.paymentStatus === 'PAID'
                                      ? `Paid${bill.paymentMethod ? ` · ${bill.paymentMethod}` : ''}`
                                      : 'Awaiting payment'}
                                  </span>
                                </td>
                                <td>{date(bill.updatedAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      empty('No bills issued yet')
                    )}
                  </GlassPanel>
                )}
                {section === 'reviews' && (
                  <>
                    <div className="admin-toolbar">
                      <h2>{pendingReviews} awaiting approval</h2>
                      <select
                        aria-label="Filter reviews"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        <option value="all">All reviews</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                      </select>
                    </div>
                    <GlassPanel className="admin-widget"><div className="admin-table-wrap"><table><thead><tr><th>Customer</th><th>Vehicle</th><th>Rating</th><th>Review</th><th>Status</th><th>Action</th></tr></thead><tbody>{data.reviews.filter(r=>matches(r.name,r.text)&&(filter==='all'||(filter==='approved'?r.approved:!r.approved))).map(r=><tr key={r._id}><td>{r.name}</td><td>{r.vehicle}</td><td>{r.rating}/5</td><td style={{whiteSpace:'normal',minWidth:240}}>{r.text}</td><td>{r.approved?'Published':'Pending'}</td><td><button className="admin-secondary" disabled={busy} onClick={()=>{triggerHaptic('light');void save('reviews',{approved:!r.approved},r._id);}}>{r.approved?'Unpublish':'Approve'}</button></td></tr>)}</tbody></table></div></GlassPanel>
                    {!data.reviews.length && empty('No reviews to moderate')}
                  </>
                )}
                {section === 'workshop' && (
                  <GlassPanel className="admin-widget admin-content-editor">
                    <div className="admin-widget-heading">
                      <div>
                        <h2>The story of your workshop</h2>
                        <p>
                          Update your public introduction and photo gallery.
                        </p>
                      </div>
                    </div>
                    <ManagementForm
                      section="workshop"
                      initial={data.workshop}
                      busy={busy}
                      onSave={(v) => void save('workshop', v)}
                    />
                  </GlassPanel>
                )}
                {section === 'settings' && (
                  <>
                    <GlassPanel className="admin-widget admin-haptics-setting">
                      <div>
                        <p className="admin-eyebrow">INTERACTION PREFERENCES</p>
                        <h2>Haptic feedback</h2>
                        <p>
                          {isReducedMotion
                            ? 'Disabled while Reduce Motion is enabled on this device.'
                            : 'Use subtle vibration feedback for controls and completed actions.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={`admin-haptic-switch ${isHapticsEnabled ? 'is-on' : ''}`}
                        role="switch"
                        aria-checked={isHapticsEnabled}
                        onClick={toggleHaptics}
                      >
                        <span aria-hidden="true" />
                        {isHapticsEnabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </GlassPanel>
                    <GlassPanel className="admin-widget admin-content-editor">
                      <div className="admin-widget-heading">
                        <h2>Business details</h2>
                      </div>
                      <ManagementForm
                        section="settings"
                        initial={data.settings}
                        busy={busy}
                        onSave={(v) => void save('settings', v)}
                      />
                    </GlassPanel>
                    <GlassPanel className="admin-widget">
                      <div className="admin-widget-heading">
                        <div>
                          <h2>Accounts & access</h2>
                          <p>Role changes revoke existing sessions.</p>
                        </div>
                      </div>
                      <div className="admin-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Account</th>
                              <th>Role</th>
                              <th>Access</th>
                              <th>
                                <span className="sr-only">Actions</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.users
                              .filter((p) => matches(p.displayName, p.email))
                              .map((p) => (
                                <tr key={p._id}>
                                  <td>
                                    {p.displayName || 'Rider'}
                                    <small>{p.email}</small>
                                  </td>
                                  <td>{p.role}</td>
                                  <td>
                                    {p.isAllowed ? 'Enabled' : 'Disabled'}
                                  </td>
                                  <td>
                                    <button
                                      className="admin-record"
                                      onClick={() => {
                                        triggerHaptic('light');
                                        return setEditor({
                                          section: 'accounts',
                                          id: p._id,
                                          title: 'Manage access',
                                          values: {
                                            role: p.role,
                                            isAllowed: p.isAllowed,
                                          },
                                        });
                                      }}
                                    >
                                      Manage
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </GlassPanel>
                  </>
                )}
              </>
            )
          )}
          <footer className="admin-footer">
            <span>
              ROYAL MECHANICS <i /> Made to endure.
            </span>
            <span>
              <ShieldCheck size={12} /> Admin workspace
            </span>
          </footer>
        </main>
      </div>
      <dialog
        aria-label={editor?.title || 'Record details'}
        ref={dialog}
        className="admin-dialog"
        onCancel={() => setEditor(null)}
      >
        {editor && (
          <>
            <div className="admin-widget-heading">
              <div>
                <p className="admin-eyebrow">ROYAL MECHANICS</p>
                <h2>{editor.title}</h2>
              </div>
              <button
                className="admin-icon"
                aria-label="Close details"
                onClick={() => {
                  triggerHaptic('light');
                  return setEditor(null);
                }}
              >
                <X size={20} />
              </button>
            </div>
            {error && (
              <p className="admin-error" role="alert">
                {error}
              </p>
            )}
            {editor.section === 'customer' ? (
              <div>
                {bookingTable(
                  data?.bookings.filter(
                    (b) => b.customerId?._id === editor.id,
                  ) || [],
                )}
              </div>
            ) : (
              <ManagementForm
                key={`${editor.section}-${editor.id}`}
                section={editor.section}
                initial={editor.values}
                busy={busy}
                users={data?.users}
                footer={
                  editor.section === 'bookings' &&
                  !data?.invoices.some(
                    (invoice) => invoice.bookingId === editor.values.bookingId,
                  ) ? (
                    <button
                      className="admin-secondary"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        triggerHaptic('light');
                        setEditor({
                          section: 'billing',
                          title: 'Generate booking bill',
                          values: {
                            bookingId: String(editor.values.bookingId),
                            serviceName: String(editor.values.serviceCategory),
                            servicePrice: Number(editor.values.estimate || 0),
                            partsPrice: 0,
                            laborPrice: 0,
                            extraPrice: 0,
                            taxRate: 0,
                          },
                        });
                      }}
                    >
                      Generate bill
                    </button>
                  ) : null
                }
                onSave={(v) =>
                  void save(
                    editor.section,
                    v,
                    editor.id || String(v.userId || ''),
                  )
                }
              />
            )}
            {editor.section === 'bookings' &&
              (() => {
                const bill = data?.invoices.find(
                  (entry) => entry.bookingId === editor.values.bookingId,
                );
                const action = async (type: 'collect' | 'send') => {
                  setBusy(true);
                  const response = await fetch('/api/bills', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: type,
                      invoiceId: bill?._id,
                      paymentMethod: 'CASH',
                    }),
                  });
                  const result = await response.json();
                  setBusy(false);
                  if (!response.ok) {
                    triggerHaptic('error');
                    setError(result.error);
                    return;
                  }
                  triggerHaptic('success');
                  setNotice(result.message);
                  setEditor(null);
                  await load();
                };
                return bill ? (
                  bill.paymentStatus === 'PAID' ? (
                    <button
                      className="admin-gold"
                      disabled={busy}
                      onClick={() => {
                        triggerHaptic('light');
                        return void action('send');
                      }}
                    >
                      Send paid bill &amp; all job photos
                    </button>
                  ) : (
                    <button
                      className="admin-gold"
                      disabled={busy}
                      onClick={() => {
                        triggerHaptic('light');
                        if (
                          window.confirm(
                            `Collect ₹${bill.total.toLocaleString('en-IN')} in cash and issue the paid bill?`,
                          )
                        )
                          void action('collect');
                      }}
                    >
                      Collect cash ₹{bill.total.toLocaleString('en-IN')}
                    </button>
                  )
                ) : null;
              })()}
            {editor.section === 'services' &&
              (editor.id || editor.values.originalName) && (
                <button
                  disabled={busy}
                  className="admin-delete"
                  onClick={() => {
                    triggerHaptic('light');
                    if (
                      window.confirm(
                        'Remove this service from the public menu?',
                      )
                    )
                      void save(
                        'services',
                        { originalName: editor.values.originalName || '' },
                        editor.id,
                        'delete',
                      );
                  }}
                >
                  Remove service
                </button>
              )}
          </>
        )}
      </dialog>
    </div>
  );
}

async function prepareInspectionPhoto(file: File) {
  if (!file.type.startsWith('image/') || file.size > 20_000_000)
    throw new Error('Choose an image smaller than 20 MB.');
  const source = URL.createObjectURL(file);
  try {
    const image = new window.Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to read this image.'));
      image.src = source;
    });
    const scale = Math.min(1, 1000 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.65);
  } finally {
    URL.revokeObjectURL(source);
  }
}

function InspectionPhotoCapture({
  values,
  onChange,
}: {
  values: Values;
  onChange: Dispatch<SetStateAction<Values>>;
}) {
  const photos = Array.isArray(values.inspectionPhotos)
    ? values.inspectionPhotos
    : [];
  async function addPhoto(file?: File) {
    if (!file) return;
    try {
      const photo = await prepareInspectionPhoto(file);
      onChange((current) => ({
        ...current,
        inspectionPhotos: [
          ...(Array.isArray(current.inspectionPhotos)
            ? current.inspectionPhotos
            : []),
          photo,
        ].slice(0, 12),
      }));
      triggerHaptic('capture');
    } catch (error) {
      triggerHaptic('error');
      window.alert(error instanceof Error ? error.message : 'Photo could not be added.');
    }
  }
  return (
    <section className="admin-inspection-capture" aria-label="Inspection photos">
      <div>
        <strong>Inspection photos</strong>
        <small>Capture the vehicle condition before work begins.</small>
      </div>
      <div className="admin-capture-tiles">
        <label>
          <Camera size={19} aria-hidden="true" />
          <span>Take photo</span>
          <small>Use your camera</small>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => {
              void addPhoto(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </label>
        <label>
          <Images size={19} aria-hidden="true" />
          <span>Upload photo</span>
          <small>Choose from library</small>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              void addPhoto(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </label>
      </div>
      {photos.length > 0 && (
        <div className="admin-photo-grid">
          {photos.map((src, index) => (
            <div className="admin-inspection-preview" key={`${src.slice(-24)}-${index}`}>
              <Image src={src} width={180} height={130} unoptimized alt={`Inspection photo ${index + 1}`} />
              <button
                type="button"
                aria-label={`Remove inspection photo ${index + 1}`}
                onClick={() =>
                  onChange((current) => ({
                    ...current,
                    inspectionPhotos: (current.inspectionPhotos as string[]).filter(
                      (_, photoIndex) => photoIndex !== index,
                    ),
                  }))
                }
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ManagementForm({
  section,
  initial,
  busy,
  onSave,
  footer,
  users = [],
}: {
  section: string;
  initial: Values;
  busy: boolean;
  onSave: (v: Values) => void;
  footer?: ReactNode;
  users?: Person[];
}) {
  const [v, setV] = useState<Values>(initial);
  const input = (
    key: string,
    label: string,
    type = 'text',
    required = ['name', 'title', 'email'].includes(key),
  ) => (
    <label key={key}>
      {label}
      <input
        name={key}
        type={type}
        value={String(v[key] ?? '')}
        min={type === 'number' ? 0 : undefined}
        step={type === 'number' ? '0.01' : undefined}
        required={required}
        onChange={(e) =>
          setV({
            ...v,
            [key]: type === 'number' ? Number(e.target.value) : e.target.value,
          })
        }
      />
    </label>
  );
  const textarea = (key: string, label: string) => (
    <label key={key}>
      {label}
      <textarea
        rows={key === 'about' ? 5 : 3}
        value={
          Array.isArray(v[key])
            ? (v[key] as string[]).join('\n')
            : String(v[key] ?? '')
        }
        onChange={(e) =>
          setV({
            ...v,
            [key]: ['photos', 'inspectionPhotos'].includes(key)
              ? e.target.value.split('\n')
              : e.target.value,
          })
        }
      />
    </label>
  );
  const checkbox = (key: string, label: string) => (
    <label className="admin-checkbox" key={key}>
      <input
        type="checkbox"
        checked={v[key] === true}
        onChange={(e) => setV({ ...v, [key]: e.target.checked })}
      />
      {label}
    </label>
  );
  return (
    <form
      className="admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(v);
      }}
    >
      <fieldset disabled={busy}>
        {section === 'services' && (
          <>
            {input('name', 'Service name')}
            {textarea('description', 'Description')}
            {input('price', 'Starting price (₹)', 'number')}
          </>
        )}
        {section === 'bookings' && (
          <>
            <label>
              Status
              <select
                value={String(v.status)}
                onChange={(e) => setV({ ...v, status: e.target.value })}
              >
                {bookingStatuses.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Assigned mechanic
              <select
                value={String(v.mechanicId || '')}
                onChange={(e) => setV({ ...v, mechanicId: e.target.value })}
              >
                <option value="">Unassigned</option>
                {users
                  .filter((u) => u.role === 'MECHANIC' && u.isAllowed)
                  .map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.displayName || 'Mechanic'} — {u.email}
                      {u.phone ? ` · ${u.phone}` : ''}
                    </option>
                  ))}
              </select>
            </label>
            {input('estimate', 'Estimate (₹)', 'number')}
            {checkbox('estimateApproved', 'Estimate approved')}
            {textarea('notes', 'Workshop notes')}
            <InspectionPhotoCapture values={v} onChange={setV} />
          </>
        )}
        {section === 'walkin' && (
          <>
            {input('customerName', 'Customer name')}
            {input('phone', 'Contact number')}
            {input('email', 'Email (optional)', 'email', false)}
            {input('vehicleName', 'Bike / vehicle')}
            {input('serviceCategory', 'Service or issue')}
            {textarea('notes', 'Workshop notes')}
          </>
        )}
        {section === 'billing' && (
          <>
            {input('serviceName', 'Service line item')}
            {input('servicePrice', 'Base service price (₹)', 'number')}
            {input('partsPrice', 'Parts used (₹)', 'number')}
            {input('laborPrice', 'Labour (₹)', 'number')}
            {input('extraPrice', 'Extra charges (₹)', 'number')}
            {input('taxRate', 'Tax rate (%)', 'number')}
          </>
        )}
        {section === 'staff' && (
          <>
            {'userId' in v && (
              <label>
                Registered account
                <select
                  required
                  value={String(v.userId)}
                  onChange={(e) => setV({ ...v, userId: e.target.value })}
                >
                  <option value="">Choose an account</option>
                  {users
                    .filter((u) => u.role === 'CUSTOMER')
                    .map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.displayName || u.email} · {u.email}
                      </option>
                    ))}
                </select>
                <small>
                  Mechanics create an account first, then receive workshop
                  access here.
                </small>
              </label>
            )}
            {input('displayName', 'Display name')}
            {textarea('specialties', 'Specialties')}
            {checkbox('isAllowed', 'Account enabled')}
          </>
        )}
        {section === 'createMechanic' && (
          <>
            {input('name', 'Mechanic name')}
            {input('email', 'Email address', 'email')}
            {input('phone', 'Phone number', 'tel')}
            {textarea('specialty', 'Specialty')}
            <p className="admin-muted">A secure temporary password is emailed immediately. The mechanic must change it at first sign-in.</p>
          </>
        )}
        {section === 'accounts' && (
          <>
            <label>
              Role
              <select
                value={String(v.role)}
                onChange={(e) => setV({ ...v, role: e.target.value })}
              >
                <option value="CUSTOMER">Customer</option>
                <option value="MECHANIC">Mechanic</option>
                <option value="ADMIN">Administrator</option>
              </select>
            </label>
            {checkbox('isAllowed', 'Account enabled')}
          </>
        )}
        {section === 'workshop' && (
          <>
            {input('title', 'Headline')}
            {textarea('description', 'Introduction')}
            {textarea('about', 'About the workshop')}
            {textarea('photos', 'Photo URLs (HTTPS, one per line)')}
          </>
        )}
        {section === 'settings' && (
          <>
            {input('hours', 'Business hours')}
            {input('phone', 'Contact phone', 'tel')}
            {input('email', 'Contact email', 'email')}
            {textarea('address', 'Workshop address')}
            {checkbox(
              'notifyBookings',
              'Show booking notifications in the admin portal',
            )}
            {checkbox(
              'notifyReviews',
              'Show review notifications in the admin portal',
            )}
          </>
        )}
        <button
          className="admin-gold"
          style={{ display: 'none' }}
          type="submit"
          onClick={() => triggerHaptic('light')}
        >
          {busy ? <Loader size="button" /> : <Check size={15} />}{' '}
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </fieldset>
      <footer className="admin-dialog-footer">
        <button
          className="admin-gold"
          type="submit"
          disabled={busy}
          onClick={() => triggerHaptic('light')}
        >
          {busy ? <Loader size="button" /> : <Check size={15} />} Save changes
        </button>
        {footer}
      </footer>
    </form>
  );
}
