import { afterEach,describe,expect,it,vi } from 'vitest';
import { GET,POST } from './route';
afterEach(()=>vi.unstubAllEnvs());
describe('worker SDK route',()=>{
 it('stays disabled without explicit configuration',async()=>{
  vi.stubEnv('RELAY_ENABLE_DURABLE_JOBS','false');const response=await GET(new Request('http://localhost/api/inngest') as never,{params:Promise.resolve({})} as never);expect(response.status).toBe(503);
 });
 it('supports local SDK introspection with synthetic configuration',async()=>{
  vi.stubEnv('RELAY_ENABLE_DURABLE_JOBS','true');vi.stubEnv('INNGEST_EVENT_KEY','synthetic-event-key');vi.stubEnv('INNGEST_SIGNING_KEY','signkey-test-00000000000000000000000000000000');vi.stubEnv('INNGEST_DEV','1');
  const response=await GET(new Request('http://localhost/api/inngest') as never,{params:Promise.resolve({})} as never);expect(response.status).toBe(200);expect(await response.text()).toContain('function_count');
 });
 it('rejects oversized input before the SDK handler is invoked',async()=>{
  vi.stubEnv('RELAY_ENABLE_DURABLE_JOBS','true');vi.stubEnv('INNGEST_EVENT_KEY','synthetic-event-key');vi.stubEnv('INNGEST_SIGNING_KEY','signkey-test-00000000000000000000000000000000');
  const request=new Request('http://localhost/api/inngest',{method:'POST',body:'x'.repeat(256*1024+1)});
  const response=await POST(request as never,{params:Promise.resolve({})} as never);expect(response.status).toBe(413);
 });
});
