import { describe, expect, it, vi, beforeEach } from 'vitest';
vi.mock('@/lib/supabase',()=>({supabase:vi.fn()}));
vi.mock('@/lib/crm/database',()=>({createDatabaseCrm:vi.fn(()=>({}))}));
vi.mock('@/lib/crm/mcp',()=>({callSandboxMcp:vi.fn()}));
import { supabase } from '@/lib/supabase';
import { callSandboxMcp } from '@/lib/crm/mcp';
import { GET,POST } from './route';
const id='00000000-0000-4000-8000-000000000001';
const context={params:Promise.resolve({id})};
const request=(origin:string|null)=>new Request('https://relay.example/api/sandbox/actions/'+id,{method:'POST',headers:origin?{origin}:{}});
describe('sandbox REST action endpoint',()=>{
 beforeEach(()=>vi.resetAllMocks());
 it('denies missing and cross-site origins before invoking the gateway',async()=>{
  expect((await POST(request(null),context)).status).toBe(403);
  expect((await POST(request('https://evil.example'),context)).status).toBe(403);
  expect(callSandboxMcp).not.toHaveBeenCalled();
 });
 it('requires a valid session',async()=>{
  vi.mocked(supabase).mockResolvedValue({auth:{getUser:async()=>({data:{user:null},error:null})}} as never);
  expect((await POST(request('https://relay.example'),context)).status).toBe(401);
  expect((await GET(new Request('https://relay.example'),context)).status).toBe(401);
 });
 it('delegates only the action id and reports gateway failure accurately',async()=>{
  vi.mocked(supabase).mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:'user'}},error:null})}} as never);
  vi.mocked(callSandboxMcp).mockRejectedValueOnce(new Error('Approval required'));
  expect((await POST(request('https://relay.example'),context)).status).toBe(409);
  expect(callSandboxMcp).toHaveBeenCalledWith({},'update_ticket_status',{actionId:id});
 });
});
