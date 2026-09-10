'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  Bell,
  Bike,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronsLeft,
  CircleDollarSign,
  Clock3,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Plus,
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
  faults?: { text: string; beforePhoto?: string; afterPhoto?: string; completed?: boolean }[];
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
  invoices: { _id: string; bookingId?: string; total: number; updatedAt: string; paymentStatus?: string; customerName?: string }[];
  workshop: typeof defaultWorkshop;
  settings: typeof defaultSettings;
};
type Values = Record<string, string | number | boolean | string[]>;
type Editor = { section: string; id?: string; title: string; values: Values };
const nav = [
  ['overview', 'Overview', LayoutDashboard],
  ['bookings', 'Bookings', CalendarDays],
  ['customers', 'Customers', Users],
  ['staff', 'Mechanics', Wrench],
  ['services', 'Services & pricing', SlidersHorizontal],
  ['reviews', 'Reviews', Star],
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
export function AdminPortal({
  viewer,
  section,
}: {
  viewer: Viewer;
  section: string;
}) {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [ascending, setAscending] = useState(false);
  const [period, setPeriod] = useState('week');
  const [popover, setPopover] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
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
    setBusy(true);
    setError('');
    try {
      const response = await fetch(section === 'billing' ? '/api/bills' : '/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(section === 'billing' ? { bookingId: values.bookingId, taxRate: Number(values.taxRate || 0), items: [{ name: values.serviceName, quantity: 1, unitPrice: Number(values.servicePrice || 0) }, ...(Number(values.partsPrice || 0) > 0 ? [{ name: 'Parts used', quantity: 1, unitPrice: Number(values.partsPrice) }] : []), ...(Number(values.laborPrice || 0) > 0 ? [{ name: 'Labour', quantity: 1, unitPrice: Number(values.laborPrice) }] : []), ...(Number(values.extraPrice || 0) > 0 ? [{ name: 'Extra charges', quantity: 1, unitPrice: Number(values.extraPrice) }] : [])] } : { section, id, action, data: values }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setEditor(null);
      setNotice(
        action === 'delete'
          ? 'Service removed from the public menu.'
          : 'Changes saved successfully.',
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
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
                <button onClick={() => setAscending(!ascending)}>
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
                    onClick={() => bookingEditor(b)}
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
                    onClick={() => bookingEditor(b)}
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
      className={`admin-shell ${collapsed ? 'is-collapsed' : ''} ${mobile ? 'mobile-open' : ''}`}
    >
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin">
          <Image
            src="/royal-mechanics-logo-alpha.png"
            width={49}
            height={49}
            alt="Royal Mechanics"
          />
          <span>
            ROYAL<small>MECHANICS</small>
          </span>
        </Link>
        <div className="admin-workspace-label">
          <i /> WORKSHOP ADMIN
        </div>
        <p className="admin-nav-caption">WORKSPACE</p>
        <nav aria-label="Admin navigation">
          {nav.map(([id, label, Icon]) => (
            <Link
              key={id}
              title={label}
              className={section === id ? 'active' : ''}
              aria-current={section === id ? 'page' : undefined}
              href={id === 'overview' ? '/admin' : `/admin/${id}`}
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
        <div className="admin-sidebar-bottom">
          <div className="admin-standard">
            <ShieldCheck size={22} />
            <strong>The Royal standard.</strong>
            <p>Every detail. Every day.</p>
          </div>
          <Link href="/">
            <ArrowLeft size={16} />
            <span>View public website</span>
          </Link>
          <button onClick={() => setCollapsed(!collapsed)}>
            <ChevronsLeft size={16} />
            <span>Collapse sidebar</span>
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="admin-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="admin-workspace">
        <header className="admin-topbar">
          <button
            className="admin-menu admin-icon"
            aria-label="Toggle navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={20} />
          </button>
          <span className="admin-breadcrumb">
            Workspace <span>/</span>{' '}
            <b>{nav.find((n) => n[0] === section)?.[1]}</b>
          </span>
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
                <button onClick={() => setQuery('')}>
                  Clear search <X size={12} />
                </button>
              </div>
            )}
          </div>
          <div className="admin-popover-anchor">
            <button
              className="admin-icon notification-bell"
              aria-label="Notifications"
              aria-expanded={popover === 'notifications'}
              onClick={() => setPopover(popover ? '' : 'notifications')}
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
          <div className="admin-popover-anchor">
            <button
              className="admin-profile"
              onClick={() => setPopover(popover ? '' : 'profile')}
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
              <div className="admin-popover">
                <b>{viewer.email}</b>
                <Link href="/admin/settings">Account settings</Link>
                <button onClick={signout}>
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            )}
          </div>
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
          {error && !editor && (
            <div className="admin-error" role="alert">
              {error}
              <button onClick={() => void load()}>Try again</button>
            </div>
          )}
          {loading && !data ? (
            <div className="admin-loading">
              <LoaderCircle className="spin" /> Loading your workshop…
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
                        ],
                        [
                          Wrench,
                          'Active jobs',
                          active.length,
                          'In the workshop',
                        ],
                        [
                          CircleDollarSign,
                          'Revenue',
                          money(revenue),
                          `Paid · this ${period}`,
                        ],
                        [
                          Star,
                          'Average rating',
                          rating,
                          `${approvedReviews.length} approved reviews`,
                        ],
                        [
                          Clock3,
                          'Pending approvals',
                          data.bookings.filter(
                            (b) => b.status === 'AWAITING_APPROVAL',
                          ).length,
                          'Estimates to review',
                        ],
                      ].map(([Icon, label, value, caption]) => {
                        const Glyph = Icon as typeof CalendarDays;
                        return (
                          <article
                            className="admin-widget admin-kpi"
                            key={String(label)}
                          >
                            <div>
                              <span>{String(label)}</span>
                              <Glyph size={18} />
                            </div>
                            <strong>{String(value)}</strong>
                            <small>{String(caption)}</small>
                          </article>
                        );
                      })}
                    </div>
                    <div className="admin-overview-grid">
                      <section className="admin-widget admin-chart">
                        <div className="admin-widget-heading">
                          <div>
                            <h2>Momentum, measured.</h2>
                            <p>Revenue & bookings</p>
                          </div>
                          <select
                            aria-label="Chart period"
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                          >
                            <option value="day">Today</option>
                            <option value="week">Last 7 days</option>
                            <option value="month">Last 30 days</option>
                          </select>
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
                                stroke="#738d83"
                                strokeWidth={2}
                                fill="transparent"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </section>
                      <section className="admin-widget admin-activity">
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
                      </section>
                    </div>
                    <section className="admin-widget">
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
                    </section>
                  </>
                )}
                {section === 'bookings' && (
                  <section className="admin-widget">
                    <div className="admin-toolbar">
                      <h2>
                        All bookings <span>{bookings.length}</span>
                      </h2>
                      <button className="admin-gold" onClick={() => setEditor({ section: 'walkin', title: 'Create walk-in booking', values: { customerName: '', phone: '', email: '', vehicleName: '', serviceCategory: '', notes: '' } })}><Plus size={15} /> Create booking</button>
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
                  </section>
                )}
                {section === 'customers' && (
                  <section className="admin-widget">
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
                                      onClick={() =>
                                        setEditor({
                                          section: 'customer',
                                          id: p._id,
                                          title: p.displayName || 'Customer',
                                          values: {},
                                        })
                                      }
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
                  </section>
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
                        onClick={() =>
                          setEditor({
                            section: 'staff',
                            title: 'Add a mechanic',
                            values: {
                              userId: '',
                              displayName: '',
                              specialties: '',
                              isAllowed: true,
                            },
                          })
                        }
                      >
                        <Plus size={15} /> Add mechanic
                      </button>
                    </div>
                    <div className="admin-staff-grid">
                      {mechanics.map((p) => {
                        const jobs = active.filter(
                          (b) => b.mechanicId === p._id,
                        );
                        return (
                          <article
                            className="admin-widget admin-staff-card"
                            key={p._id}
                          >
                            <span className="admin-avatar">
                              {(p.displayName || p.email)
                                .slice(0, 2)
                                .toUpperCase()}
                            </span>
                            <h2>{p.displayName || 'Mechanic'}</h2>
                            <p>{p.email}</p>
                            <span className="admin-status">
                              {p.isAllowed ? 'Active' : 'Disabled'}
                            </span>
                            <p>{p.specialties || 'General servicing'}</p>
                            <div className="admin-workload">
                              <span>Current workload</span>
                              <b>{jobs.length} jobs</b>
                            </div>
                            {jobs.map((b) => (
                              <small key={b._id}>
                                {b.vehicleName} · {statusLabel(b.status)}
                              </small>
                            ))}
                            <button
                              className="admin-secondary"
                              onClick={() =>
                                setEditor({
                                  section: 'staff',
                                  id: p._id,
                                  title: 'Mechanic profile',
                                  values: {
                                    displayName: p.displayName || '',
                                    specialties: p.specialties || '',
                                    isAllowed: p.isAllowed,
                                  },
                                })
                              }
                            >
                              Edit profile <ArrowRight size={13} />
                            </button>
                          </article>
                        );
                      })}
                    </div>
                    {!mechanics.length && empty('Build your workshop team')}
                  </>
                )}
                {section === 'services' && (
                  <section className="admin-widget">
                    <div className="admin-widget-heading">
                      <div>
                        <h2>Service menu</h2>
                        <p>Saved changes appear on the public Services page.</p>
                      </div>
                      <button
                        className="admin-gold"
                        onClick={() =>
                          setEditor({
                            section: 'services',
                            title: 'Add service',
                            values: { name: '', description: '', price: 0 },
                          })
                        }
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
                                    onClick={() =>
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
                                      })
                                    }
                                  >
                                    Edit <ArrowRight size={12} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
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
                    <div className="admin-review-grid">
                      {data.reviews
                        .filter(
                          (r) =>
                            matches(r.name, r.text) &&
                            (filter === 'all' ||
                              (filter === 'approved'
                                ? r.approved
                                : !r.approved)),
                        )
                        .map((r) => (
                          <article
                            className="admin-widget admin-review"
                            key={r._id}
                          >
                            <div className="admin-stars">
                              {Array.from({ length: r.rating }, (_, i) => (
                                <Star key={i} size={14} fill="currentColor" />
                              ))}
                            </div>
                            <blockquote>{r.text}</blockquote>
                            <b>{r.name}</b>
                            <small>
                              {r.vehicle} · {date(r.createdAt)}
                            </small>
                            <button
                              disabled={busy}
                              className={
                                r.approved ? 'admin-secondary' : 'admin-gold'
                              }
                              onClick={() =>
                                void save(
                                  'reviews',
                                  { approved: !r.approved },
                                  r._id,
                                )
                              }
                            >
                              {r.approved
                                ? 'Unpublish review'
                                : 'Approve & publish'}{' '}
                              <Check size={14} />
                            </button>
                          </article>
                        ))}
                    </div>
                    {!data.reviews.length && empty('No reviews to moderate')}
                  </>
                )}
                {section === 'workshop' && (
                  <section className="admin-widget admin-content-editor">
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
                  </section>
                )}
                {section === 'settings' && (
                  <>
                    <section className="admin-widget admin-content-editor">
                      <div className="admin-widget-heading">
                        <h2>Business details</h2>
                      </div>
                      <ManagementForm
                        section="settings"
                        initial={data.settings}
                        busy={busy}
                        onSave={(v) => void save('settings', v)}
                      />
                    </section>
                    <section className="admin-widget">
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
                                      onClick={() =>
                                        setEditor({
                                          section: 'accounts',
                                          id: p._id,
                                          title: 'Manage access',
                                          values: {
                                            role: p.role,
                                            isAllowed: p.isAllowed,
                                          },
                                        })
                                      }
                                    >
                                      Manage
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
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
                onClick={() => setEditor(null)}
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
                onSave={(v) =>
                  void save(
                    editor.section,
                    v,
                    editor.id || String(v.userId || ''),
                  )
                }
              />
            )}
            {editor.section === 'bookings' && (() => { const bill = data?.invoices.find((entry) => entry.bookingId === editor.values.bookingId); const action = async (type: 'collect' | 'send') => { setBusy(true); const response = await fetch('/api/bills', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: type, invoiceId: bill?._id, paymentMethod: 'CASH' }) }); const result = await response.json(); setBusy(false); if (!response.ok) { setError(result.error); return; } setNotice(result.message); setEditor(null); await load(); }; return bill ? bill.paymentStatus === 'PAID' ? <button className="admin-gold" disabled={busy} onClick={() => void action('send')}>Send paid bill &amp; all job photos</button> : <button className="admin-gold" disabled={busy} onClick={() => { if (window.confirm(`Collect ₹${bill.total.toLocaleString('en-IN')} in cash and issue the paid bill?`)) void action('collect'); }}>Collect cash ₹{bill.total.toLocaleString('en-IN')}</button> : <button className="admin-gold" onClick={() => setEditor({ section: 'billing', title: 'Generate booking bill', values: { bookingId: String(editor.values.bookingId), serviceName: String(editor.values.serviceCategory), servicePrice: Number(editor.values.estimate || 0), partsPrice: 0, laborPrice: 0, extraPrice: 0, taxRate: 0 } })}>Generate bill</button>; })()}
            {editor.section === 'services' &&
              (editor.id || editor.values.originalName) && (
                <button
                  disabled={busy}
                  className="admin-delete"
                  onClick={() => {
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

function ManagementForm({
  section,
  initial,
  busy,
  onSave,
  users = [],
}: {
  section: string;
  initial: Values;
  busy: boolean;
  onSave: (v: Values) => void;
  users?: Person[];
}) {
  const [v, setV] = useState<Values>(initial);
  const input = (key: string, label: string, type = 'text', required = ['name', 'title', 'email'].includes(key)) => (
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
                      {u.displayName || u.email}
                    </option>
                  ))}
              </select>
            </label>
            {input('estimate', 'Estimate (₹)', 'number')}
            {checkbox('estimateApproved', 'Estimate approved')}
            {textarea('notes', 'Workshop notes')}
            {textarea(
              'inspectionPhotos',
              'Inspection photo URLs (HTTPS, one per line)',
            )}
            {Array.isArray(v.inspectionPhotos) && (
              <div className="admin-photo-grid">
                {v.inspectionPhotos
                  .filter((s) => s.startsWith('https://'))
                  .map((src, i) => (
                    <a key={i} href={src} target="_blank" rel="noreferrer">
                      <Image
                        src={src}
                        width={180}
                        height={130}
                        unoptimized
                        alt={`Inspection photo ${i + 1}`}
                      />
                    </a>
                  ))}
              </div>
            )}
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
        <button className="admin-gold" type="submit">
          {busy ? (
            <LoaderCircle size={15} className="spin" />
          ) : (
            <Check size={15} />
          )}{' '}
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </fieldset>
    </form>
  );
}
