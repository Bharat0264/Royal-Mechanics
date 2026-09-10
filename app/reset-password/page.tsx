import { AuthExperience } from '../components/auth-experience';
export const metadata = {
  title: 'Reset password | Royal Mechanics',
  referrer: 'no-referrer',
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthExperience initialMode={token ? 'reset' : 'forgot'} token={token} />
  );
}
