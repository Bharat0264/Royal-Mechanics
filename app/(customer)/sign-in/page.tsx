import { AuthExperience } from '@/app/components/auth-experience';

export const metadata = { title: 'Sign in | Royal Mechanics' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const messages: Record<string, string> = {
    'google-unavailable':
      'Google sign-in is not configured yet. Please use email.',
    'google-denied':
      'Google sign-in was cancelled. Please choose an account to continue.',
    'google-state':
      'Your Google sign-in session expired. Please try again from this page.',
    'google-token':
      'Google could not validate the app credentials. Update the OAuth client secret and callback URL in Google Cloud, then try again.',
    'google-profile':
      'Google did not return a verified email address for this account.',
    'google-account':
      'This Google account is unavailable or is already linked to another identity.',
    'google-server':
      'The account service could not complete Google sign-in. Please try again shortly.',
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
