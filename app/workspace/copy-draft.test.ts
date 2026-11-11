import { beforeEach,describe,expect,it,vi } from 'vitest';
vi.mock('@/lib/supabase',()=>({supabase:vi.fn()}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('next/navigation',()=>({redirect:()=>{throw Error('redirect');}}));
import { supabase } from '@/lib/supabase';
import { getApprovedDraft } from './actions';
const caseId='00000000-0000-4000-8000-000000000001';
function client(role:string,record:unknown){return {auth:{getUser:async()=>({data:{user:{id:'user'}},error:null})},from:(table:string)=>({select:()=>({eq:()=>table==='memberships'?{maybeSingle:async()=>({data:{org_id:'org',role},error:null})}:{eq:()=>({maybeSingle:async()=>({data:record,error:null})})}})})};}
describe('copy approved draft',()=>{
 beforeEach(()=>vi.resetAllMocks());
 it('returns only the exact approved draft with current knowledge',async()=>{
  vi.mocked(supabase).mockResolvedValue(client('operator',{draft:'Hello',draft_review_state:'approved',draft_review_revision:3,organizations:{knowledge_revision:3}}) as never);
  expect(await getApprovedDraft(caseId,'Hello')).toEqual({ok:true,draft:'Hello'});expect(await getApprovedDraft(caseId,'Unsaved edit')).toEqual({ok:false});
 });
 it('denies viewers, unavailable cases and stale or rejected review',async()=>{
  for(const [role,record] of [['viewer',{draft:'Hello',draft_review_state:'approved',draft_review_revision:3,organizations:{knowledge_revision:3}}],['owner',null],['owner',{draft:'Hello',draft_review_state:'approved',draft_review_revision:2,organizations:{knowledge_revision:3}}],['owner',{draft:'Hello',draft_review_state:'rejected',draft_review_revision:3,organizations:{knowledge_revision:3}}]] as const){vi.mocked(supabase).mockResolvedValue(client(role,record) as never);expect(await getApprovedDraft(caseId,'Hello')).toEqual({ok:false});}
 });
});
