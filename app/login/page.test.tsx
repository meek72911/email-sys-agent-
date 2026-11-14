import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Login from './page';

afterEach(() => vi.unstubAllEnvs());

function configure(demo = true) {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.invalid');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'test');
  if (demo) {
    vi.stubEnv('RELAY_ENABLE_DEMO_LOGIN', 'true');
    vi.stubEnv('RELAY_DEMO_EMAIL', 'demo@example.com');
    vi.stubEnv('RELAY_DEMO_PASSWORD', 'synthetic-password');
  }
}

describe('login presentation', () => {
  it('offers the shared synthetic demo only when configured', async () => {
    configure();
    const html = renderToStaticMarkup(await Login({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('Open synthetic demo');
    expect(html).toContain('Do not enter real customer data');
  });

  it('hides the demo button when the flag is off', async () => {
    configure(false);
    const html = renderToStaticMarkup(await Login({ searchParams: Promise.resolve({}) }));
    expect(html).not.toContain('Open synthetic demo');
  });

  it('explains a demo sign-in failure without exposing credentials', async () => {
    configure();
    const html = renderToStaticMarkup(await Login({ searchParams: Promise.resolve({ error: 'demo' }) }));
    expect(html).toContain('The demo is unavailable');
    expect(html).not.toContain('synthetic-password');
  });
});
