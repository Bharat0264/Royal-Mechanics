'use client';

import dynamic from 'next/dynamic';
import type { Viewer } from '@/lib/auth';
import { Loader } from './loader';

const AdminPortal = dynamic(
  () => import('./admin-portal').then((module) => module.AdminPortal),
  { ssr: false, loading: () => <Loader size="full" label="Loading admin workspace" /> },
);

export function LazyAdminPortal({ viewer, section }: { viewer: Viewer; section: string }) {
  return <AdminPortal viewer={viewer} section={section} />;
}
