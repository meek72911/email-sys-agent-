/** Server-only demo configuration. Never expose the demo password to the browser. */
export function demoLoginEnabled() {
  return process.env.RELAY_ENABLE_DEMO_LOGIN === 'true'
    && !!process.env.RELAY_DEMO_EMAIL
    && !!process.env.RELAY_DEMO_PASSWORD;
}

export function isDemoEmail(email: string | null | undefined) {
  return !!email && !!process.env.RELAY_DEMO_EMAIL
    && email.toLowerCase() === process.env.RELAY_DEMO_EMAIL.toLowerCase();
}
