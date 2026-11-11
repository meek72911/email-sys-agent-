import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite({extensions:{pgcrypto}});
try{
 await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated; insert into auth.users values ('00000000-0000-0000-0000-000000000001');`);
 const bundle=await readFile('supabase/hosted-existing-project.sql','utf8');
 await assert.rejects(()=>db.exec(bundle),/001 is missing or incomplete/);await db.exec('rollback');
 await db.exec(await readFile('supabase/migrations/202611110001_initial.sql','utf8'));
 await db.exec("select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false); set role authenticated; select public.create_relay_workspace(); reset role;");
 assert.equal((await db.query('select count(*)::int as n from public.cases')).rows[0].n,10);
 const broken=bundle.replace('-- BEGIN 202611110004_document_ingestion.sql','select 1/0;\n-- BEGIN 202611110004_document_ingestion.sql');
 assert.notEqual(broken,bundle);await assert.rejects(()=>db.exec(broken),/division by zero/);await db.exec('rollback');
 assert.equal((await db.query("select to_regclass('public.crm_actions') as value")).rows[0].value,null);
 assert.equal((await db.query('select count(*)::int as n from public.cases')).rows[0].n,10);
 await db.exec(bundle);
 assert.equal((await db.query('select count(*)::int as n from public.cases')).rows[0].n,50);
 await db.exec('set role authenticated');
 const result=await db.query("select public.relay_create_manual_case('Test','Subject','Synthetic message') as id");assert.ok(result.rows[0].id);
 assert.equal((await db.query("select * from public.relay_search_cases('Synthetic message',0)")).rows.length,1);
 await db.exec('reset role');
 await assert.rejects(()=>db.exec(bundle),/later Relay migration appears present/);await db.exec('rollback');
 assert.equal((await db.query('select count(*)::int as n from public.cases')).rows[0].n,51);
 console.log('Bundle passed local checks: missing-base denial, mid-migration rollback, existing-workspace upgrade, manual intake, search and repeat-run denial.');
}finally{await db.close();}
