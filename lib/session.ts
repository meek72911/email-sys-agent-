import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';

/**
 * Resolve the signed-in user for a server-rendered workspace page.
 * Missing configuration and missing sessions both fail closed at the login screen.
 */
export async function requireUser() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    redirect('/login');
  }

  const client = await supabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect('/login');

  return { client, user: data.user };
}
