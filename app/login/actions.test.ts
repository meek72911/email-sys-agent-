import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/supabase', () => ({ supabase: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw Error('redirect:' + path); } }));
import { supabase } from '@/lib/supabase';
import { demoLogin } from './actions';

function client(error: unknown = null) {
  return {
    auth: { signInWithPassword: vi.fn(async () => ({ error })) },
    rpc: vi.fn(async () => ({ error: null })),
  };
}

describe('shared demo login', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('RELAY_ENABLE_DEMO_LOGIN', 'true');
    vi.stubEnv('RELAY_DEMO_EMAIL', 'demo@example.com');
    vi.stubEnv('RELAY_DEMO_PASSWORD', 'synthetic-password');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('signs in with server-only credentials and provisions the demo workspace', async () => {
    const value = client();
    vi.mocked(supabase).mockResolvedValue(value as never);
    await expect(demoLogin()).rejects.toThrow('redirect:/workspace');
    expect(value.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'demo@example.com', password: 'synthetic-password' });
    expect(value.rpc).toHaveBeenCalledWith('create_relay_workspace');
  });

  it('fails closed when the demo flag is disabled', async () => {
    vi.stubEnv('RELAY_ENABLE_DEMO_LOGIN', 'false');
    await expect(demoLogin()).rejects.toThrow('redirect:/login?error=demo');
    expect(supabase).not.toHaveBeenCalled();
  });

  it('does not reveal which demo credential failed', async () => {
    vi.mocked(supabase).mockResolvedValue(client({ message: 'invalid login credentials' }) as never);
    await expect(demoLogin()).rejects.toThrow('redirect:/login?error=demo');
  });
});
