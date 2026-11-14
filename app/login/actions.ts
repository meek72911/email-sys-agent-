"use server";
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { demoLoginEnabled } from '@/lib/demo';

export async function login(form: FormData) {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!email || !password) redirect('/login?error=credentials');
  const client = await supabase();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) redirect('/login?error=credentials');
  redirect('/workspace');
}

/**
 * Shared synthetic demo. The password stays in server-only environment variables;
 * visitors receive a normal Supabase session for the demo account.
 */
export async function demoLogin() {
  if (!demoLoginEnabled()) redirect('/login?error=demo');
  const email = process.env.RELAY_DEMO_EMAIL as string;
  const password = process.env.RELAY_DEMO_PASSWORD as string;
  const client = await supabase();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) redirect('/login?error=demo');
  // Idempotent: creates the synthetic workspace and fills in missing fixtures.
  await client.rpc('create_relay_workspace');
  redirect('/workspace');
}

export async function logout() {
  const client = await supabase();
  await client.auth.signOut();
  redirect('/login');
}
