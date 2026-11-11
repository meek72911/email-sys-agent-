import { login } from './actions';
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const configured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return <main className="shell"><section className="panel"><p className="brand">Relay</p><h1>Sign in to Relay</h1><p>Review customer requests and proposed actions in one workspace.</p>
    {!configured ? <p role="alert">Supabase is not configured. Add the project URL and publishable key to the server environment.</p> : <form action={login}><label>Email<input name="email" type="email" required autoComplete="username" /></label><label>Password<input name="password" type="password" required autoComplete="current-password" /></label>{error && <p role="alert">Unable to sign in. Check your email and password.</p>}<button>Sign in</button></form>}
  </section></main>;
}
