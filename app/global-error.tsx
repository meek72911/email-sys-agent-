'use client';

/* A global error replaces the root layout, so these links intentionally reload the app. */
/* eslint-disable @next/next/no-html-link-for-pages */

import { useEffect } from 'react';
import './globals.css';

export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="state-page" id="main">
          <a className="brand" href="/" aria-label="Relay home">
            <span className="brand-mark" aria-hidden="true"><span /><span /></span>
            Relay
          </a>
          <div className="state-card">
            <p className="card-index">Unexpected error</p>
            <h1>Relay could not load this page.</h1>
            <p>The request did not report a successful result. Try again or return to the overview.</p>
            <div className="button-row">
              <button type="button" onClick={() => retry()}>Try again</button>
              <a className="button secondary" href="/">Back to overview</a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
