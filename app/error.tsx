'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Route render failed', { digest: error.digest });
  }, [error]);

  return (
    <main className="route-error" role="alert">
      <p className="kicker">TEMPORARY ISSUE</p>
      <h1>That part of the workshop needs a moment.</h1>
      <p>Your data has not been changed. Try again, or return to the home page.</p>
      <div className="route-error-actions">
        <button type="button" onClick={reset}>Try again</button>
        <Link href="/">Return home</Link>
      </div>
    </main>
  );
}
