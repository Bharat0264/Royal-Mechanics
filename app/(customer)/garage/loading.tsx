import { Loader } from '@/app/components/loader';

/** Immediate branded fallback while private garage data streams from the server. */
export default function GarageLoading() {
  return <Loader size="full" label="Loading your garage" />;
}
