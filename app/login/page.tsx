import { AuthExperience } from '@/app/components/auth-experience';
import { getViewer } from '@/lib/auth';
import { roleHomePath } from '@/lib/role-redirect';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Login | Royal Mechanics',
  robots: { index: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const viewer = await getViewer();
  if (viewer)
    redirect(roleHomePath(viewer.role));
  const { error } = await searchParams;
  const messages: Record<string, string> = {
    'google-unavailable':
      'Google sign-in is not configured yet. Please use email.',
    'google-denied':
      'Google sign-in was cancelled. Please choose an account to continue.',
    'google-state': 'Google sign-in expired. Please try again.',
    'google-token': 'Google could not validate the app credentials.',
    'google-profile': 'Google did not return a verified email address.',
    'google-account': 'This Google account is unavailable.',
    'google-server':
      'The account service could not complete sign-in. Please try again.',
  };
  return (
    <AuthExperience
      initialError={
        error
          ? messages[error] ||
            'Google sign-in could not be completed. Please try again.'
          : ''
      }
    />
  );
}
