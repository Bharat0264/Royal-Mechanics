import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { connectMongo } from '@/lib/mongodb';
import { ServiceRequest } from '@/lib/models';
import { ReviewSubmissionPage } from '@/app/components/review-submission';

export const metadata = { title: 'Share your experience | Royal Mechanics', robots: { index: false } };
export default async function ReviewSharePage() {
  const viewer = await getViewer();
  if (!viewer || viewer.isGuest || viewer.role !== 'CUSTOMER') redirect('/login');
  await connectMongo();
  const jobs = await ServiceRequest.find({ customerId: viewer.id, status: 'COMPLETED' }).select('vehicleName serviceCategory requestNumber').sort({ completedAt: -1 }).lean();
  return <ReviewSubmissionPage jobs={JSON.parse(JSON.stringify(jobs))} />;
}
