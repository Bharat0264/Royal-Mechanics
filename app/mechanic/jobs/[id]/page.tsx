import { notFound, redirect } from 'next/navigation';
import { isValidObjectId } from 'mongoose';
import { getViewer } from '@/lib/auth';
import { ServiceRequest } from '@/lib/models';
import { MechanicJobEditor } from '@/app/components/mechanic-portal';
export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await getViewer();
  if (viewer?.role !== 'MECHANIC') redirect('/');
  if (viewer.mustChangePassword) redirect('/mechanic/set-password');
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();
  const job = await ServiceRequest.findOne({
    _id: id,
    mechanicId: viewer.id,
  }).lean();
  if (!job) notFound();
  return (
    <MechanicJobEditor
      initial={JSON.parse(
        JSON.stringify({
          ...job,
          intakePhotos: job.intakePhotos || [],
          faults: job.faults || [],
        }),
      )}
    />
  );
}
