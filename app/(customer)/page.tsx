import { getViewer } from '@/lib/auth';
import { roleHomePath } from '@/lib/role-redirect';
import { redirect } from 'next/navigation';
import { HomePage } from '@/app/components/public-site';
import { connectMongo } from '@/lib/mongodb';
import { Review, ServiceRequest } from '@/lib/models';

export default async function Page() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  if (viewer && !viewer.isGuest && viewer.role !== 'CUSTOMER')
    redirect(roleHomePath(viewer.role));
  let trustStats = { completedJobs: 0, averageRating: null as number | null };
  try {
    await connectMongo();
    const [completedJobs, ratings] = await Promise.all([
      ServiceRequest.countDocuments({ status: 'COMPLETED' }),
      Review.aggregate<{ averageRating: number }>([
        { $match: { approved: true } },
        { $group: { _id: null, averageRating: { $avg: '$rating' } } },
      ]),
    ]);
    trustStats = {
      completedJobs,
      averageRating: ratings[0]?.averageRating ?? null,
    };
  } catch {
    // The page remains available during a transient database outage; the next
    // request will retry the live counts instead of using a fabricated number.
  }
  return <HomePage trustStats={trustStats} />;
}
