import { demoLogin, login } from './actions';
import { demoLoginEnabled } from '@/lib/demo';

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const configured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const demo = configured && demoLoginEnabled();
  return <main className="shell"><section className="panel"><p className="brand">Relay</p><h1>Sign in to Relay</h1><p>Review customer requests and proposed actions in one workspace.</p>
    {!configured ? <p role="alert">Supabase is not configured. Add the project URL and publishable key to the server environment.</p> : <form action={login}><label>Email<input name="email" type="email" required autoComplete="username" /></label><label>Password<input name="password" type="password" required autoComplete="current-password" /></label>{error && <p role="alert">{error === 'demo' ? 'The demo is unavailable. Try again later.' : 'Unable to sign in. Check your email and password.'}</p>}<button>Sign in</button></form>}
    {demo && <><hr /><h2>Try the synthetic demo</h2><p>Open a shared workspace filled with synthetic requests. Changes are visible to other visitors and reset nightly. Do not enter real customer data.</p><form action={demoLogin}><button className="secondary">Open synthetic demo</button></form></>}
  </section></main>;
}
