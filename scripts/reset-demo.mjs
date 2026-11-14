import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

// Rebuilds the shared synthetic demo workspace. Server-only values:
// NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
// SUPABASE_SERVICE_ROLE_KEY, RELAY_DEMO_EMAIL, RELAY_DEMO_PASSWORD.
//
// Usage: npm run demo:reset -- --confirm

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.RELAY_DEMO_EMAIL;
const password = process.env.RELAY_DEMO_PASSWORD;

if (!process.argv.includes('--confirm')) {
  throw Error('Refusing to reset shared demo data. Re-run with --confirm.');
}
if (!url || !anonKey || !serviceKey || !email || !password) {
  throw Error('Set the Supabase URL, publishable key, service-role key, demo email and demo password first.');
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

function demoClient() {
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

async function findUser() {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw Error(`Could not list users: ${error.message}`);
    const found = data.users.find(item => item.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function ensureUser() {
  const existing = await findUser();
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    if (error) throw Error(`Could not reset the demo account credential: ${error.message}`);
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw Error(`Could not create the demo account: ${error?.message ?? 'unknown error'}`);
  return data.user.id;
}

async function signIn() {
  const client = demoClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw Error(`Could not sign in the demo account: ${error.message}`);
  return client;
}

async function main() {
  console.log('Resetting the shared synthetic demo workspace.');
  const userId = await ensureUser();
  const client = await signIn();

  const { data: memberships, error: membershipError } = await admin
    .from('memberships').select('org_id').eq('user_id', userId);
  if (membershipError) throw Error(`Could not read demo memberships: ${membershipError.message}`);

  for (const membership of memberships ?? []) {
    const { error } = await admin.from('organizations').delete().eq('id', membership.org_id);
    if (error) throw Error(`Could not remove the old demo workspace: ${error.message}`);
  }

  const { data: orgId, error: createError } = await client.rpc('create_relay_workspace');
  if (createError || !orgId) throw Error(`Could not create the demo workspace: ${createError?.message ?? 'no workspace id'}`);

  // Operators can run the review and sandbox workflow but cannot delete the
  // workspace, knowledge or requests. That keeps the shared demo recoverable.
  const { error: roleError } = await admin.from('memberships')
    .update({ role: 'operator' }).eq('org_id', orgId).eq('user_id', userId);
  if (roleError) throw Error(`Could not set the demo role: ${roleError.message}`);

  const { count: cases, error: caseError } = await admin.from('cases')
    .select('*', { head: true, count: 'exact' }).eq('org_id', orgId);
  if (caseError) throw Error(`Could not count demo cases: ${caseError.message}`);
  assert.equal(cases, 50);

  const { count: knowledge, error: knowledgeError } = await admin.from('knowledge_documents')
    .select('*', { head: true, count: 'exact' }).eq('org_id', orgId);
  if (knowledgeError) throw Error(`Could not count demo knowledge: ${knowledgeError.message}`);
  assert.ok(knowledge && knowledge > 0);

  console.log(`Demo reset complete: 50 synthetic cases and ${knowledge} knowledge sections.`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Demo reset failed');
  process.exitCode = 1;
});
