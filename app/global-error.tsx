'use client';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body className="global-error-body">
        <main className="route-error" role="alert">
          <p className="kicker">TEMPORARY ISSUE</p>
          <h1>Royal Mechanics is temporarily unavailable.</h1>
          <p>Please try again in a moment.</p>
          <button type="button" onClick={reset}>Try again</button>
        </main>
      </body>
    </html>
  );
}
