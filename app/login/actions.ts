"use server";
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export async function login(form: FormData) {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!email || !password) redirect('/login?error=credentials');
  const client = await supabase();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) redirect('/login?error=credentials');
  redirect('/workspace');
}
export async function logout() {
  const client = await supabase();
  await client.auth.signOut();
  redirect('/login');
}
