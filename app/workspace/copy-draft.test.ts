import { beforeEach,describe,expect,it,vi } from 'vitest';
vi.mock('@/lib/supabase',()=>({supabase:vi.fn()}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('next/navigation',()=>({redirect:()=>{throw Error('redirect');}}));
import { supabase } from '@/lib/supabase';
import { getApprovedDraft } from './actions';
const caseId='00000000-0000-4000-8000-000000000001';
function client(value:unknown,error:unknown=null){return {auth:{getUser:async()=>({data:{user:{id:'user'}},error:null})},rpc:vi.fn(async()=>({data:value,error}))};}
describe('copy approved draft',()=>{
 beforeEach(()=>vi.resetAllMocks());
 it('asks the database for the exact approved text and returns it only when it matches',async()=>{
  const c=client('Hello');vi.mocked(supabase).mockResolvedValue(c as never);
  expect(await getApprovedDraft(caseId,'Hello')).toEqual({ok:true,draft:'Hello'});expect(c.rpc).toHaveBeenCalledWith('relay_get_approved_draft',{p_case:caseId,p_expected:'Hello'});
  expect(await getApprovedDraft(caseId,'Unsaved edit')).toEqual({ok:false});
 });
 it('denies unavailable or unexpected database results',async()=>{
  for(const [value,error] of [[null,null],['Hello',{message:'denied'}],['different',null]] as const){vi.mocked(supabase).mockResolvedValue(client(value,error) as never);expect(await getApprovedDraft(caseId,'Hello')).toEqual({ok:false});}
 });
});
