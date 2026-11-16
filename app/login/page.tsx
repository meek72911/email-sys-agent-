import type { Metadata } from 'next';
import Link from 'next/link';
import { demoLogin, login } from './actions';
import { demoLoginEnabled } from '@/lib/demo';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: false } };

const points = [
  {
    number: '01',
    title: 'Evidence before prose.',
    body: 'A draft is withheld when an issue has no source. Policy passages carry their section and version.',
  },
  {
    number: '02',
    title: 'Approvals are exact.',
    body: 'The action, the status change and the knowledge revision are checked together before execution.',
  },
  {
    number: '03',
    title: 'No email leaves Relay.',
    body: 'An approved reply is copied into your mail client. Gmail access is read-only and off by default.',
  },
];

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const configured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const demo = configured && demoLoginEnabled();

  return (
    <main className="auth-shell">
      <section className="auth-aside">
        <Link href="/" className="brand auth-brand" aria-label="Relay home">
          <span className="brand-mark" aria-hidden="true"><span /><span /></span>
          Relay
        </Link>

        <div className="auth-thesis">
          <p className="page-kicker">Customer operations</p>
          <p className="auth-statement">Every reply gets a source. Every change gets a reviewer.</p>
          <p className="auth-intro">
            Relay holds the request, the evidence, the draft and the ticket change in one place,
            so the next person can see why a decision was made.
          </p>
        </div>

        <ul className="auth-points">
          {points.map(point => (
            <li key={point.number}>
              <span>{point.number}</span>
              <div>
                <strong>{point.title}</strong>
                <p>{point.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="auth-aside-foot">Portfolio build · synthetic data only</p>
      </section>

      <section className="auth-main">
        <div className="auth-panel">
          <Link href="/" className="auth-back">← Overview</Link>

          <header className="auth-head">
            <p className="page-kicker">Workspace access</p>
            <h1>Sign in to Relay</h1>
            <p>Review customer requests and proposed actions in one workspace.</p>
          </header>

          {!configured
            ? (
              <p className="notice notice-error" role="alert">
                Supabase is not configured. Add the project URL and publishable key to the server environment.
              </p>
            )
            : (
              <form action={login} className="auth-form">
                <label>
                  Email
                  <input name="email" type="email" required autoComplete="username" />
                </label>
                <label>
                  Password
                  <input name="password" type="password" required autoComplete="current-password" />
                </label>
                {error && (
                  <p role="alert">
                    {error === 'demo'
                      ? 'The demo is unavailable. Try again later.'
                      : 'Unable to sign in. Check your email and password.'}
                  </p>
                )}
                <button>Sign in</button>
              </form>
            )}

          {demo && (
            <div className="auth-demo">
              <div className="auth-divider"><span>or</span></div>
              <h2>Try the synthetic demo</h2>
              <p>
                Open a shared workspace filled with synthetic requests. Changes are visible to
                other visitors and reset nightly.
              </p>
              <p className="auth-warning">Do not enter real customer data.</p>
              <form action={demoLogin}>
                <button className="secondary">Open synthetic demo</button>
              </form>
            </div>
          )}

          <p className="auth-legal">
            Relay is a portfolio build. No email is sent, and the ticket sandbox is local.
          </p>
        </div>
      </section>
    </main>
  );
}
