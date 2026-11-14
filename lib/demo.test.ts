import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoLoginEnabled, isDemoEmail } from './demo';

afterEach(() => vi.unstubAllEnvs());

describe('shared demo configuration', () => {
  it('requires the explicit flag and both server-only credentials', () => {
    expect(demoLoginEnabled()).toBe(false);
    vi.stubEnv('RELAY_ENABLE_DEMO_LOGIN', 'true');
    vi.stubEnv('RELAY_DEMO_EMAIL', 'demo@example.com');
    expect(demoLoginEnabled()).toBe(false);
    vi.stubEnv('RELAY_DEMO_PASSWORD', 'synthetic-password');
    expect(demoLoginEnabled()).toBe(true);
  });

  it('recognizes the configured demo account case-insensitively', () => {
    vi.stubEnv('RELAY_DEMO_EMAIL', 'Demo@Example.com');
    expect(isDemoEmail('demo@example.com')).toBe(true);
    expect(isDemoEmail('other@example.com')).toBe(false);
    expect(isDemoEmail(null)).toBe(false);
  });
});
