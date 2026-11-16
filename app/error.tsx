'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function ErrorPage({
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
    <main className="state-page" id="main">
      <Link className="brand" href="/" aria-label="Relay home">
        <span className="brand-mark" aria-hidden="true"><span /><span /></span>
        Relay
      </Link>
      <div className="state-card">
        <p className="card-index">Unexpected error</p>
        <h1>The workspace could not finish that request.</h1>
        <p>
          No action was reported as successful. Try the request again; if it repeats, return to the
          inbox and check the case’s current state.
        </p>
        <div className="button-row">
          <button type="button" onClick={() => retry()}>Try again</button>
          <Link className="button secondary" href="/workspace">Back to inbox</Link>
        </div>
      </div>
    </main>
  );
}
