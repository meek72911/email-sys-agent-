import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const bootstrap = `create role anon nologin; create role authenticated nologin; create role service_role nologin; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated; insert into auth.users values ('00000000-0000-0000-0000-000000000001');`;

const existing = new PGlite({ extensions: { pgcrypto } });
try {
  await existing.exec(bootstrap);
  const bundle = await readFile('supabase/hosted-existing-project.sql', 'utf8');
  await assert.rejects(() => existing.exec(bundle), /001 is missing or incomplete/);
  await existing.exec('rollback');
  await existing.exec(await readFile('supabase/migrations/202611110001_initial.sql', 'utf8'));
  await existing.exec("select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false); set role authenticated; select public.create_relay_workspace(); reset role;");
  assert.equal((await existing.query('select count(*)::int as n from public.cases')).rows[0].n, 10);
  const broken = bundle.replace('-- BEGIN 202611110004_document_ingestion.sql', 'select 1/0;\n-- BEGIN 202611110004_document_ingestion.sql');
  assert.notEqual(broken, bundle);
  await assert.rejects(() => existing.exec(broken), /division by zero/);
  await existing.exec('rollback');
  assert.equal((await existing.query("select to_regclass('public.crm_actions') as value")).rows[0].value, null);
  assert.equal((await existing.query('select count(*)::int as n from public.cases')).rows[0].n, 10);
  await existing.exec(bundle);
  assert.equal((await existing.query('select count(*)::int as n from public.cases')).rows[0].n, 50);
  await existing.exec('set role authenticated');
  const result = await existing.query("select public.relay_create_manual_case('Test','Subject','Synthetic message') as id");
  assert.ok(result.rows[0].id);
  assert.equal((await existing.query("select * from public.relay_search_cases('Synthetic message',0)")).rows.length, 1);
  await existing.exec('reset role');
  await assert.rejects(() => existing.exec(bundle), /later Relay migration appears present/);
  await existing.exec('rollback');
  assert.equal((await existing.query('select count(*)::int as n from public.cases')).rows[0].n, 51);
  console.log('Existing-project bundle passed local checks: missing-base denial, mid-migration rollback, existing-workspace upgrade, manual intake, search and repeat-run denial.');
} finally {
  await existing.close();
}

const fresh = new PGlite({ extensions: { pgcrypto } });
try {
  await fresh.exec(bootstrap);
  const bundle = await readFile('supabase/fresh-project.sql', 'utf8');
  await fresh.exec(bundle);
  await fresh.exec("select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false); set role authenticated; select public.create_relay_workspace(); reset role;");
  assert.equal((await fresh.query('select count(*)::int as n from public.cases')).rows[0].n, 50);
  assert.notEqual((await fresh.query("select to_regclass('public.crm_actions') as value")).rows[0].value, null);
  assert.notEqual((await fresh.query("select to_regclass('public.workspace_audit_events') as value")).rows[0].value, null);
  assert.equal((await fresh.query("select count(*)::int as n from information_schema.columns where table_schema='public' and table_name='action_jobs' and column_name='failure_code'")).rows[0].n, 1);
  await assert.rejects(() => fresh.exec(bundle), /Relay tables already exist/);
  await fresh.exec('rollback');
  assert.equal((await fresh.query('select count(*)::int as n from public.cases')).rows[0].n, 50);
  console.log('Fresh-project bundle passed local checks: all migrations apply in order, latest diagnostics column exists, repeat-run denial and rollback.');
} finally {
  await fresh.close();
}
