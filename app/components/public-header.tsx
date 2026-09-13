'use client';
import { triggerHaptic } from '@/lib/haptics';
import { roleHomePath } from '@/lib/role-redirect';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, LogOut, Menu, X } from 'lucide-react';
import styles from './public-header.module.css';

const links = [
  ['Home', '/'],
  ['Services', '/services'],
  ['Workshop', '/our-workshop'],
  ['Reviews', '/reviews'],
  ['FAQ & Contact', '/contact'],
] as const;

const utilityRoutes = ['/book-service', '/garage'];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
}

function NavLinks({
  pathname,
  mobile = false,
  onNavigate,
}: {
  pathname: string;
  mobile?: boolean;
  onNavigate?: (href: string) => void;
}) {
  const navRef = useRef<HTMLElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const active = links.findIndex(([, href]) => isActive(pathname, href));
  const highlighted = hovered ?? focused ?? active;

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    let frame = 0;

    // Both decorations persist across routes. Only their measured coordinates change.
    const measure = () => {
      const bounds = [active, highlighted].map((index) => {
        const link = linkRefs.current[index];
        return link && link.offsetWidth > 0
          ? {
              x: link.offsetLeft,
              y: link.offsetTop,
              width: link.offsetWidth,
              height: link.offsetHeight,
            }
          : null;
      });

      bounds.forEach((box, index) => {
        if (!box) return;
        const prefix = index === 0 ? 'active' : 'pill';
        const underline = index === 0 && !mobile;
        nav.style.setProperty(
          `--${prefix}-x`,
          `${box.x + (underline ? 14 : 0)}px`,
        );
        nav.style.setProperty(
          `--${prefix}-y`,
          `${box.y + (underline ? box.height - 2 : 0)}px`,
        );
        nav.style.setProperty(
          `--${prefix}-width`,
          `${box.width - (underline ? 28 : 0)}px`,
        );
        nav.style.setProperty(
          `--${prefix}-height`,
          `${underline ? 2 : box.height}px`,
        );
      });

      if (bounds[0] && !nav.dataset.ready) {
        frame = requestAnimationFrame(() => {
          nav.dataset.ready = 'true';
        });
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    linkRefs.current.forEach((link) => {
      if (link) observer.observe(link);
    });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [active, highlighted, mobile]);

  return (
    <nav
      ref={navRef}
      className={`${styles.links} ${mobile ? styles.mobileLinks : styles.desktopLinks}`}
      aria-label={mobile ? 'Mobile navigation' : 'Main navigation'}
    >
      <span
        aria-hidden="true"
        className={styles.activeIndicator}
        data-visible={active >= 0}
      />
      <span
        aria-hidden="true"
        className={styles.hoverPill}
        data-visible={hovered !== null || focused !== null}
      />
      {links.map(([label, href], index) => (
        <Link
          key={href}
          ref={(node) => {
            linkRefs.current[index] = node;
          }}
          href={href}
          className={styles.navLink}
          aria-current={isActive(pathname, href) ? 'page' : undefined}
          onPointerEnter={(event) => {
            if (event.pointerType !== 'touch') setHovered(index);
          }}
          onPointerLeave={() => setHovered(null)}
          onFocus={(event) => {
            setFocused(index);
            if (event.currentTarget.matches(':focus-visible')) setHovered(null);
          }}
          onBlur={() => setFocused(null)}
          onNavigate={() => {
            setHovered(null);
            setFocused(null);
            onNavigate?.(href);
          }}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function PublicHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [viewer, setViewer] = useState<{
    role: string;
    displayName: string | null;
    email: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (active) setViewer(data.viewer || null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pathname]);
  const accountHref = viewer
    ? roleHomePath(viewer.role as 'ADMIN' | 'MECHANIC' | 'CUSTOMER')
    : '/login';
  const customer = viewer?.role === 'CUSTOMER';
  useEffect(() => {
    if (customer) router.prefetch('/garage');
  }, [customer, router]);
  const authenticated = Boolean(viewer);
  const accountLabel = customer ? 'My garage' : 'Account';
  const initials = (viewer?.displayName || viewer?.email || 'RM')
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const publicRoute =
    links.some(([, href]) => isActive(pathname, href)) ||
    utilityRoutes.includes(pathname);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    let compact = false;
    const onScroll = () => {
      // Hysteresis prevents the changing header height from toggling at the threshold.
      compact = compact ? window.scrollY > 16 : window.scrollY > 64;
      header.dataset.compact = String(compact);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [publicRoute]);

  useEffect(() => {
    // Let the mobile active pill arrive before closing; route changes aren't delayed.
    const timer = window.setTimeout(() => {
      if (menuRef.current?.contains(document.activeElement))
        toggleRef.current?.focus();
      setOpen(false);
    }, 240);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent | FocusEvent) => {
      if (
        event.target instanceof Node &&
        !headerRef.current?.contains(event.target)
      )
        setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const desktop = window.matchMedia('(min-width: 1025px)');
    const onResize = () => {
      if (desktop.matches) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('focusin', dismiss);
    document.addEventListener('keydown', onKeyDown);
    desktop.addEventListener('change', onResize);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('focusin', dismiss);
      document.removeEventListener('keydown', onKeyDown);
      desktop.removeEventListener('change', onResize);
    };
  }, [open]);

  useEffect(() => {
    if (!profileOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !profileRef.current?.contains(event.target))
        setProfileOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [profileOpen]);

  async function signOut() {
    triggerHaptic('light');
    await fetch('/api/auth/signout', { method: 'POST' });
    window.location.assign('/');
  }

  if (!publicRoute) return null;

  return (
    <header ref={headerRef} className={styles.header}>
      <Link
        className={styles.brand}
        href="/"
        aria-label="Royal Mechanics home"
        onNavigate={() => setOpen(false)}
      >
        <Image
          className={styles.crest}
          src="/royal-mechanics-logo-alpha.png"
          width={74}
          height={74}
          quality={100}
          sizes="74px"
          priority
          alt=""
        />
        <b>
          ROYAL<small>MECHANICS</small>
        </b>
      </Link>
      <NavLinks pathname={pathname} />
      <div className={styles.actions}>
        {authenticated ? (
          <div className={styles.profileWrap} ref={profileRef}>
            <button
              className={styles.profileChip}
              type="button"
              aria-label="Open account menu"
              aria-expanded={profileOpen}
              onClick={() => {
                triggerHaptic('light');
                setProfileOpen(!profileOpen);
              }}
            >
              <span>{initials}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            {profileOpen && (
              <div className={styles.profileMenu} role="menu">
                <div className={styles.profileIdentity}>
                  <strong>{viewer?.displayName || 'Royal Mechanics rider'}</strong>
                  <span>{viewer?.email}</span>
                </div>
                {customer ? (
                  <Link href="/garage" role="menuitem" onNavigate={() => setProfileOpen(false)}>
                    My garage
                  </Link>
                ) : (
                  <Link href={accountHref} role="menuitem" onNavigate={() => setProfileOpen(false)}>
                    {accountLabel}
                  </Link>
                )}
                <button type="button" role="menuitem" onClick={() => void signOut()}>
                  <LogOut size={14} aria-hidden="true" /> Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link className={`${styles.signin} ${styles.desktopSignin}`} href={accountHref}>
            Sign in
          </Link>
        )}
        <Link
          className={`${styles.booking} ${styles.headerBooking}`}
          href="/book-service"
        >
          <span>Book Service</span>
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
        <button
          ref={toggleRef}
          type="button"
          className={styles.toggle}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="public-mobile-menu"
          onClick={() => {
            triggerHaptic('light');
            return setOpen(!open);
          }}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>
      <div
        ref={menuRef}
        id="public-mobile-menu"
        className={styles.mobileMenu}
        data-open={open}
        inert={!open}
        aria-hidden={!open}
      >
        <div className={styles.menuScroll}>
          <p className={styles.menuLabel}>EXPLORE ROYAL MECHANICS</p>
          <NavLinks
            pathname={pathname}
            mobile
            onNavigate={(href) => {
              if (isActive(pathname, href)) {
                setOpen(false);
                toggleRef.current?.focus();
              }
            }}
          />
        </div>
        <div className={styles.menuActions}>
          {authenticated ? (
            <Link className={styles.signin} href={customer ? '/garage' : accountHref} onNavigate={() => setOpen(false)}>
              {accountLabel}
            </Link>
          ) : (
            <Link className={styles.signin} href={accountHref} onNavigate={() => setOpen(false)}>
              Sign in
            </Link>
          )}
          <Link
            className={styles.booking}
            href="/book-service"
            onNavigate={() => setOpen(false)}
          >
            <span>Book Service</span>
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}
