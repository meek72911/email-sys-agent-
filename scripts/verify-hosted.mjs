import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

// Hosted verification for a disposable Supabase project. This creates synthetic
// users and workspaces, checks the migration-backed RLS boundaries, and removes
// what it created. It never prints keys, tokens or raw row contents.
//
// Usage:
//   cp .env.verify.example .env.verify.local   (fill in disposable project values)
//   npm run verify:hosted -- --confirm

const url = process.env.VERIFY_SUPABASE_URL;
const anonKey = process.env.VERIFY_SUPABASE_ANON_KEY;
const serviceKey = process.env.VERIFY_SUPABASE_SERVICE_ROLE_KEY;
const expectedTables = [
  'organizations', 'memberships', 'cases', 'crm_actions', 'audit_events',
  'knowledge_documents', 'analysis_usage', 'analysis_global_usage', 'action_jobs',
  'external_dispatches', 'gmail_oauth_attempts', 'gmail_credentials', 'gmail_selections',
  'knowledge_audit_events', 'workspace_audit_events', 'relay_fixture_catalog',
];

if (!process.argv.includes('--confirm')) {
  throw Error('Refusing to write synthetic records. Re-run with --confirm against a disposable project.');
}
if (!url || !anonKey || !serviceKey) {
  throw Error('Set VERIFY_SUPABASE_URL, VERIFY_SUPABASE_ANON_KEY and VERIFY_SUPABASE_SERVICE_ROLE_KEY (see .env.verify.example).');
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const suffix = randomUUID().slice(0, 8);
const createdUsers = [];
const createdOrgs = [];
const checks = [];

function pass(name) {
  checks.push(name);
  console.log(`PASS ${name}`);
}

function client() {
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

async function createUser(label) {
  const email = `relay-verify-${label}-${suffix}@example.com`;
  const password = `Rl!${randomUUID()}Aa1`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw Error(`Could not create ${label} verification user: ${error?.message ?? 'unknown error'}`);
  createdUsers.push(data.user.id);
  const supabase = client();
  const signedIn = await supabase.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw Error(`Could not sign in ${label} verification user: ${signedIn.error.message}`);
  return { email, supabase, userId: data.user.id };
}

async function createWorkspace(user, label) {
  const { data, error } = await user.supabase.rpc('create_relay_workspace');
  if (error) throw Error(`Could not create ${label} workspace: ${error.message}`);
  createdOrgs.push(data);
  return data;
}

async function count(user, table, filters = {}) {
  let query = user.supabase.from(table).select('*', { head: true, count: 'exact' });
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const { count: value, error } = await query;
  if (error) throw Error(`${table} count failed: ${error.message}`);
  return value;
}

async function main() {
  console.log(`Verifying disposable project: ${url}`);
  console.log('Creating synthetic users; no real data is read or written.');

  for (const table of expectedTables) {
    const { error } = await admin.from(table).select('*', { head: true, count: 'exact' }).limit(1);
    if (error) throw Error(`Migration check failed for ${table}: ${error.message}`);
  }
  pass('all expected tables exist');

  const ownerA = await createUser('owner-a');
  const ownerB = await createUser('owner-b');
  const viewer = await createUser('viewer');
  const orgA = await createWorkspace(ownerA, 'owner-a');
  const orgB = await createWorkspace(ownerB, 'owner-b');
  const viewerOrg = await createWorkspace(viewer, 'viewer');
  pass('three synthetic users can create isolated workspaces');

  assert.equal(await count(ownerA, 'cases', { org_id: orgA }), 50);
  assert.equal(await count(ownerB, 'cases', { org_id: orgB }), 50);
  pass('each workspace receives exactly 50 fixtures');

  const caseA = (await ownerA.supabase.from('cases').select('id,ticket_status').eq('org_id', orgA).limit(1)).data?.[0];
  const caseB = (await ownerB.supabase.from('cases').select('id').eq('org_id', orgB).limit(1)).data?.[0];
  assert.ok(caseA && caseB, 'Expected a case in each workspace');

  const crossRead = await ownerA.supabase.from('cases').select('id').eq('id', caseB.id);
  assert.equal(crossRead.data?.length ?? 0, 0);
  pass('cross-organization case read returns no rows');

  const crossWrite = await ownerA.supabase.from('cases').update({ subject: 'should not persist' }).eq('id', caseB.id);
  assert.ok(crossWrite.error, 'Cross-organization update should be denied');
  const crossRpc = await ownerA.supabase.rpc('relay_save_draft', { p_case: caseB.id, p_draft: 'should not persist' });
  assert.ok(crossRpc.error, 'Cross-organization draft write should be denied');
  pass('cross-organization writes are denied');

  const anonymous = client();
  const anonymousRead = await anonymous.from('cases').select('id').limit(1);
  assert.equal(anonymousRead.data?.length ?? 0, 0);
  pass('anonymous reads return no rows');

  const draft = 'Synthetic verification draft. No message is sent.';
  assert.ok(!(await ownerA.supabase.rpc('relay_save_draft', { p_case: caseA.id, p_draft: draft })).error);
  assert.ok(!(await ownerA.supabase.rpc('relay_review_draft', { p_case: caseA.id, p_draft: draft, p_decision: 'approved' })).error);
  pass('owner can save and approve a draft');

  const action = await ownerA.supabase.rpc('relay_propose_status', { p_case: caseA.id, p_status: 'pending' });
  if (action.error || !action.data) throw Error(`Proposal failed: ${action.error?.message ?? 'no action id'}`);
  assert.ok(!(await ownerA.supabase.rpc('relay_approve_status', { p_action: action.data, p_from: 'open', p_to: 'pending' })).error);
  const executed = await ownerA.supabase.rpc('relay_execute_status', { p_action: action.data });
  assert.equal(executed.data, 'succeeded');
  const updatedCase = await ownerA.supabase.from('cases').select('ticket_status').eq('id', caseA.id).single();
  assert.equal(updatedCase.data?.ticket_status, 'pending');
  pass('exact-payload approval and sandbox execution succeed');

  const auditCount = await count(ownerA, 'audit_events', { org_id: orgA });
  assert.ok(auditCount >= 4, 'Expected proposal, approval and execution audit events');
  pass('audit events are recorded for the approved action');

  const added = await ownerA.supabase.rpc('relay_add_knowledge', {
    p_title: 'Synthetic verification policy',
    p_sections: [{ section: 'Verification', content: 'Synthetic verification evidence for hosted checks.' }],
  });
  if (added.error) throw Error(`Knowledge write failed: ${added.error.message}`);
  const found = await ownerA.supabase.rpc('relay_search_knowledge', { p_query: 'verification' });
  assert.ok((found.data?.length ?? 0) > 0);
  pass('knowledge write and full-text search work');

  const failureColumn = await admin.from('action_jobs').select('failure_code').limit(1);
  assert.ok(!failureColumn.error, `Latest job diagnostics migration is missing: ${failureColumn.error?.message ?? ''}`);
  const dispatchColumn = await admin.from('external_dispatches').select('sync_state').limit(1);
  assert.ok(!dispatchColumn.error, `External dispatch migration is missing: ${dispatchColumn.error?.message ?? ''}`);
  pass('latest migration columns are present');

  const viewerUpdate = await admin.from('memberships').update({ role: 'viewer' }).eq('org_id', viewerOrg).eq('user_id', viewer.userId);
  assert.ok(!viewerUpdate.error, 'Could not set viewer role for verification');
  const viewerCase = (await viewer.supabase.from('cases').select('id').eq('org_id', viewerOrg).limit(1)).data?.[0];
  const viewerWrite = await viewer.supabase.rpc('relay_propose_status', { p_case: viewerCase.id, p_status: 'pending' });
  assert.ok(viewerWrite.error, 'Viewer should not be able to propose a change');
  assert.equal(await count(viewer, 'cases', { org_id: viewerOrg }), 50);
  pass('viewer can read but cannot write');

  console.log(`\nHosted verification passed: ${checks.length} checks.`);
  console.log('Cleaning up synthetic users and organizations.');
}

async function cleanup() {
  for (const org of createdOrgs) {
    const { error } = await admin.from('organizations').delete().eq('id', org);
    if (error) console.warn(`Cleanup warning for an organization: ${error.message}`);
  }
  for (const userId of createdUsers) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) console.warn(`Cleanup warning for a verification user: ${error.message}`);
  }
}

try {
  await main();
} finally {
  await cleanup();
}
