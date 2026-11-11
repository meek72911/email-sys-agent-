import { afterEach, describe, expect, it } from 'vitest';
import { createSandboxServer } from './server.mjs';
import { createHttpSandboxProvider, hashSandboxPayload } from '../lib/crm/http-sandbox';
import { dispatchOnce } from '../lib/crm/reconciliation';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const token='0123456789abcdef0123456789abcdef';
const orgId='10000000-0000-4000-8000-000000000001',ticketId='20000000-0000-4000-8000-000000000001',actionId='30000000-0000-4000-8000-000000000001';
let server,dir;
async function start(dbPath=':memory:'){server=createSandboxServer({token,dbPath});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return `http://127.0.0.1:${server.address().port}/`;}
async function stop(){if(server){await new Promise(resolve=>server.close(resolve));server=undefined;}}
function localStore(hash){let state='queued';const read=()=>({id:actionId,payloadHash:hash,state});return {get:async()=>read(),claim:async()=>{if(state!=='queued')return null;state='dispatching';return read();},mark:async(_id,next)=>{if(state!=='succeeded'&&state!=='failed')state=next;return state;}};}
afterEach(async()=>{await stop();if(dir)await rm(dir,{recursive:true,force:true});dir=undefined;});
describe('independent sandbox CRM HTTP service',()=>{
 it('reconciles a committed write after its HTTP response is lost, then persists the receipt',async()=>{
  dir=await mkdtemp(join(tmpdir(),'relay-crm-'));const dbPath=join(dir,'crm.sqlite');let base=await start(dbPath);
  const headers={authorization:`Bearer ${token}`,'content-type':'application/json'};
  expect((await fetch(base+'tickets',{method:'POST',headers,body:JSON.stringify({orgId,ticketId})})).status).toBe(200);
  const payload={actionId,orgId,ticketId,fromStatus:'open',toStatus:'pending'};
  let sends=0;
  const fetcher=async(url,options)=>{const response=await fetch(url,options);if(options.method==='POST' && new URL(url).pathname==='/actions'){sends++;throw new Error('response lost after server commit');}return response;};
  const provider=createHttpSandboxProvider({baseUrl:base,token,loadPayload:async()=>payload,fetcher});const store=localStore(hashSandboxPayload(payload));
  expect(await dispatchOnce(store,provider,actionId)).toBe('succeeded');expect(sends).toBe(1);
  expect((await (await fetch(base+`tickets/${ticketId}?orgId=${orgId}`,{headers})).json()).status).toBe('pending');
  await stop();base=await start(dbPath);
  const replay=await (await fetch(base+'actions',{method:'POST',headers,body:JSON.stringify(payload)})).json();expect(replay.state).toBe('succeeded');
  expect((await fetch(base+'actions',{method:'POST',headers,body:JSON.stringify({...payload,toStatus:'resolved'})})).status).toBe(409);
 });
 it('records a stale-state failure and never applies it on a later replay',async()=>{
  const base=await start();const headers={authorization:'Bearer '+token,'content-type':'application/json'};
  await fetch(base+'tickets',{method:'POST',headers,body:JSON.stringify({orgId,ticketId})});
  const payload={actionId,orgId,ticketId,fromStatus:'pending',toStatus:'resolved'};
  const response=await (await fetch(base+'actions',{method:'POST',headers,body:JSON.stringify(payload)})).json();expect(response.state).toBe('failed');
  const again=await (await fetch(base+'actions',{method:'POST',headers,body:JSON.stringify(payload)})).json();expect(again.state).toBe('failed');
  expect((await (await fetch(base+`tickets/${ticketId}?orgId=${orgId}`,{headers})).json()).status).toBe('open');
 });
 it('rejects unauthorized callers, cross-workspace receipt reads and invalid destinations',async()=>{
  const base=await start();expect((await fetch(base+'tickets',{method:'POST',body:'{}'})).status).toBe(401);
  const headers={authorization:`Bearer ${token}`,'content-type':'application/json'};
  await fetch(base+'tickets',{method:'POST',headers,body:JSON.stringify({orgId,ticketId})});
  const payload={actionId,orgId,ticketId,fromStatus:'open',toStatus:'pending'};
  await fetch(base+'actions',{method:'POST',headers,body:JSON.stringify(payload)});
  expect((await fetch(base+`receipts/${actionId}?orgId=10000000-0000-4000-8000-000000000002`,{headers})).status).toBe(404);
  expect(()=>createHttpSandboxProvider({baseUrl:'https://example.com/',token,loadPayload:async()=>payload})).toThrow(/loopback/);
 });
});
