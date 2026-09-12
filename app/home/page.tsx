import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { roleHomePath } from '@/lib/role-redirect';

// Retire the former shared portal URL without introducing a second routing map.
export default async function HomePage() {
  const viewer = await getViewer();
  redirect(roleHomePath(viewer?.role));
}
