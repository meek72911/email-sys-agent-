import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <main className="state-page" id="main">
      <Link className="brand" href="/" aria-label="Relay home">
        <span className="brand-mark" aria-hidden="true"><span /><span /></span>
        Relay
      </Link>
      <div className="state-card">
        <p className="card-index">404</p>
        <h1>That page is not in this workspace.</h1>
        <p>The address may be older than the current build, or the record may have been deleted.</p>
        <div className="button-row">
          <Link className="button" href="/workspace">Open the workspace</Link>
          <Link className="button secondary" href="/">Back to overview</Link>
        </div>
      </div>
    </main>
  );
}
