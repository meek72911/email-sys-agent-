import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFile,readdir } from 'node:fs/promises';
import { createSandboxServer } from '../../sandbox-crm/server.mjs';
import { createPersistentDispatchStore } from './dispatch-store';
import { createHttpSandboxProvider } from './http-sandbox';
import { dispatchOnce } from './reconciliation';
const uid='00000000-0000-4000-8000-000000000001';
const token='0123456789abcdef0123456789abcdef';
describe('persistent dispatch and separate CRM',()=>{
 it('commits an authorized action once and recovers a lost HTTP response',async()=>{
  const db=new PGlite({extensions:{pgcrypto}});let server;
  try{
   await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated; insert into auth.users values ('${uid}');`);
   for(const file of (await readdir('supabase/migrations')).filter(x=>x.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
   await db.exec(`select set_config('request.jwt.claim.sub','${uid}',false); set role authenticated;`);
   const orgId=(await db.query('select public.create_relay_workspace() as id')).rows[0].id;
   const caseId=(await db.query('select id from public.cases limit 1')).rows[0].id;
   const actionId=(await db.query("select public.relay_propose_status($1,'pending') as id",[caseId])).rows[0].id;
   await db.query("select public.relay_approve_status($1,'open','pending')",[actionId]);
   await db.query('select public.relay_prepare_external_dispatch($1)',[actionId]);
   await db.exec('reset role; set role service_role');
   const client={from:()=>({select:()=>({eq:(_key,id)=>({maybeSingle:async()=>{const q=await db.query('select * from public.external_dispatches where id=$1',[id]);return {data:q.rows[0]??null,error:null};}})})}),rpc:async(name,args)=>{try{const q=name==='relay_claim_external_dispatch'?await db.query('select public.relay_claim_external_dispatch($1) as value',[args.p_action]):await db.query('select public.relay_mark_external_dispatch($1,$2,$3) as value',[args.p_action,args.p_state,args.p_hash]);return {data:q.rows[0].value,error:null};}catch(error){return {data:null,error};}}};
   const {store,loadPayload}=createPersistentDispatchStore(client);
   server=createSandboxServer({token});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const baseUrl=`http://127.0.0.1:${server.address().port}/`;
   let sends=0;const fetcher=async(url,options)=>{const response=await fetch(url,options);if(new URL(url).pathname==='/actions'){sends++;throw Error('response lost');}return response;};
   const provider=createHttpSandboxProvider({baseUrl,token,loadPayload,fetcher});
   expect(await dispatchOnce(store,provider,actionId)).toBe('succeeded');
   expect(await dispatchOnce(store,provider,actionId)).toBe('succeeded');expect(sends).toBe(1);
   const status=await db.query('select state,sync_state from public.external_dispatches where id=$1',[actionId]);
   expect(status.rows[0]).toMatchObject({state:'succeeded',sync_state:'synced'});
   await db.exec('reset role');
   expect((await db.query('select ticket_status from public.cases where id=$1',[caseId])).rows[0].ticket_status).toBe('pending');
   expect((await db.query('select state from public.crm_actions where id=$1',[actionId])).rows[0].state).toBe('succeeded');
   await db.exec('set role authenticated');
   const second=(await db.query("select public.relay_propose_status($1,'resolved') as id",[caseId])).rows[0].id;
   await db.query("select public.relay_approve_status($1,'pending','resolved')",[second]);
   await db.query('select public.relay_prepare_external_dispatch($1)',[second]);
   await db.exec('reset role; set role service_role');
   expect(await dispatchOnce(store,provider,second)).toBe('succeeded');
   expect(sends).toBe(2);
   const auth={authorization:`Bearer ${token}`};expect((await (await fetch(`${baseUrl}tickets/${caseId}?orgId=${orgId}`,{headers:auth})).json()).status).toBe('resolved');
  }finally{if(server)await new Promise(resolve=>server.close(resolve));await db.close();}
 },20000);
});
