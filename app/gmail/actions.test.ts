import { beforeEach,describe,expect,it,vi } from 'vitest';
vi.mock('@/lib/supabase',()=>({supabase:vi.fn()}));
vi.mock('@/lib/gmail/config',()=>({gmailConfig:vi.fn()}));
vi.mock('@/lib/gmail/import-config',()=>({gmailImportEnabled:vi.fn()}));
vi.mock('@/lib/gmail/vault',()=>({createCredentialVault:vi.fn()}));
vi.mock('@/lib/gmail/client',()=>({openGmailMcp:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:vi.fn()}));
import { supabase } from '@/lib/supabase';
import { gmailConfig } from '@/lib/gmail/config';
import { gmailImportEnabled } from '@/lib/gmail/import-config';
import { createCredentialVault } from '@/lib/gmail/vault';
import { openGmailMcp } from '@/lib/gmail/client';
import { createClient } from '@supabase/supabase-js';
import { importGmail,searchGmail } from './actions';
const uid='00000000-0000-4000-8000-000000000001',org='00000000-0000-4000-8000-000000000002',caseId='00000000-0000-4000-8000-000000000003';
const form=(key:string,value:string)=>{const f=new FormData();f.set(key,value);return f;};
describe('explicit Gmail operations',()=>{
 let order:string[],rpc:ReturnType<typeof vi.fn>,adminRpc:ReturnType<typeof vi.fn>,callTool:ReturnType<typeof vi.fn>,close:ReturnType<typeof vi.fn>;
 beforeEach(()=>{
  vi.resetAllMocks();order=[];
  vi.mocked(gmailConfig).mockReturnValue({clientId:'client',clientSecret:'secret',callbackUrl:'https://example.invalid',key:'key',supabaseUrl:'https://example.invalid',serviceKey:'service',allowLocal:false});vi.mocked(gmailImportEnabled).mockReturnValue(true);
  rpc=vi.fn(async(name:string)=>{order.push(name);return {data:name==='relay_gmail_status'?'active':true,error:null};});
  const client={auth:{getUser:async()=>({data:{user:{id:uid}},error:null})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{org_id:org,role:'owner'},error:null})})})}),rpc};
  vi.mocked(supabase).mockResolvedValue(client as never);adminRpc=vi.fn(async()=>{order.push('import');return {data:caseId,error:null};});vi.mocked(createClient).mockReturnValue({rpc:adminRpc} as never);
  vi.mocked(createCredentialVault).mockReturnValue({getActive:async()=>({tokens:{accessToken:'test',expiresAt:Date.now()+120000},version:1})} as never);
  callTool=vi.fn(async()=>{order.push('read');return {structuredContent:{id:'msg1',subject:'Test',sender:'Synthetic',plaintextBody:'Body'}};});close=vi.fn(async()=>{});vi.mocked(openGmailMcp).mockResolvedValue({callTool,close} as never);
 });
 it('does not open Gmail when the feature is disabled or input is invalid',async()=>{
  vi.mocked(gmailImportEnabled).mockReturnValue(false);expect((await searchGmail({},form('query','invoice'))).error).toBeTruthy();
  expect((await importGmail({},form('messageId','../bad'))).error).toBeTruthy();expect(openGmailMcp).not.toHaveBeenCalled();expect(adminRpc).not.toHaveBeenCalled();
 });
 it('records and rechecks selection before reading and importing',async()=>{
  expect(await importGmail({},form('messageId','msg1'))).toEqual({caseId});
  expect(order).toEqual(['relay_select_gmail_message','relay_is_gmail_message_selected','read','import']);expect(close).toHaveBeenCalledOnce();
 });
 it('does not import a mismatched message and closes the client',async()=>{
  callTool.mockResolvedValue({structuredContent:{id:'different',plaintextBody:'Body'}});expect((await importGmail({},form('messageId','msg1'))).error).toBeTruthy();expect(adminRpc).not.toHaveBeenCalled();expect(close).toHaveBeenCalledOnce();
 });
 it('reports revocation or database denial without claiming an import',async()=>{
  adminRpc.mockResolvedValue({data:null,error:{message:'selection unavailable'}});expect((await importGmail({},form('messageId','msg1'))).error).toBeTruthy();expect(close).toHaveBeenCalledOnce();
  rpc.mockImplementation(async(name:string)=>({data:name==='relay_is_gmail_message_selected'?false:true,error:null}));callTool.mockClear();expect((await importGmail({},form('messageId','msg1'))).error).toBeTruthy();expect(callTool).not.toHaveBeenCalled();
 });
});
