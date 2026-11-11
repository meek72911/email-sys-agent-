import { describe,expect,it,vi,beforeEach,afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('next/server',()=>({connection:async()=>{}}));
vi.mock('next/navigation',()=>({redirect:()=>{throw Error('redirect');}}));
vi.mock('@/lib/supabase',()=>({supabase:vi.fn()}));
vi.mock('@/app/login/actions',()=>({logout:async()=>{}}));
vi.mock('./actions',()=>({createWorkspace:async()=>{},saveDraft:async()=>{},approveDraft:async()=>{},rejectDraft:async()=>{},deleteRequest:async()=>{},propose:async()=>{},approve:async()=>{},reject:async()=>{},execute:async()=>{},enqueueExecution:async()=>{},queueExternalSandbox:async()=>{},checkExternalSandbox:async()=>{}}));
vi.mock('./analysis-actions',()=>({analyzeCase:async()=>({})}));
import { supabase } from '@/lib/supabase';
import Workspace from './page';
const row={id:'00000000-0000-4000-8000-000000000001',customer:'Test',subject:'Invoice',message:'Invoice issue',created_at:'2026-01-01',ticket_status:'open',draft:'Saved',draft_review_state:'unreviewed',draft_review_revision:null,organizations:{knowledge_revision:1},source_kind:'synthetic',expires_at:null};
function fakeClient(role:string|null,roleError=false,actionState='needs_approval',sourceKind='synthetic'){return {auth:{getUser:async()=>({data:{user:{id:'u',email:'test@example.invalid'}},error:null})},from:(table:string)=>({select:()=>({eq:()=>table==='memberships'?{maybeSingle:async()=>({data:role?{role}:null,error:roleError?{}:null})}:{order:()=>({limit:async()=>({data:table==='crm_actions'?[{id:'a',from_status:'open',to_status:'pending',state:actionState,created_at:'2026-01-01'}]:[],error:null})})},order:()=>({limit:async()=>({data:[{...row,source_kind:sourceKind}],error:null})})})})};}
describe('workspace role presentation',()=>{
 beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://example.invalid');vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','test');});
 afterEach(()=>vi.unstubAllEnvs());
 it('renders the case without edit or approval buttons for viewers',async()=>{
  vi.mocked(supabase).mockResolvedValue(fakeClient('viewer') as never);
  const html=renderToStaticMarkup(await Workspace({searchParams:Promise.resolve({})}));
  expect(html).toContain('Read-only access');expect(html).toContain('Draft (read only)');expect(html).not.toContain('Save draft');expect(html).not.toContain('Approve saved draft');expect(html).not.toContain('Reject saved draft');expect(html).not.toContain('Review change');expect(html).not.toContain('Approve exact change');expect(html).not.toContain('Reject change');expect(html).not.toContain('Analyze with OpenAI');
 });
 it('hides execution controls for a viewer even after approval',async()=>{
  vi.mocked(supabase).mockResolvedValue(fakeClient('viewer',false,'approved') as never);
  const html=renderToStaticMarkup(await Workspace({searchParams:Promise.resolve({})}));expect(html).not.toContain('Execute sandbox change now');expect(html).not.toContain('Queue background execution');expect(html).not.toContain('Send to separate sandbox');
 });
 it('offers permitted controls to operators',async()=>{
  vi.mocked(supabase).mockResolvedValue(fakeClient('operator') as never);
  const html=renderToStaticMarkup(await Workspace({searchParams:Promise.resolve({})}));expect(html).toContain('Save draft');expect(html).toContain('Approve saved draft');expect(html).toContain('Reject saved draft');expect(html).toContain('Review change');expect(html).toContain('Approve exact change');expect(html).toContain('Reject change');
 });
 it('offers deletion only to owners for manual or imported requests',async()=>{
  vi.mocked(supabase).mockResolvedValue(fakeClient('owner',false,'needs_approval','manual') as never);
  expect(renderToStaticMarkup(await Workspace({searchParams:Promise.resolve({})}))).toContain('Type DELETE to confirm');
  vi.mocked(supabase).mockResolvedValue(fakeClient('operator',false,'needs_approval','manual') as never);
  expect(renderToStaticMarkup(await Workspace({searchParams:Promise.resolve({})}))).not.toContain('Type DELETE to confirm');
  vi.mocked(supabase).mockResolvedValue(fakeClient('owner',false,'needs_approval','synthetic') as never);
  expect(renderToStaticMarkup(await Workspace({searchParams:Promise.resolve({})}))).not.toContain('Type DELETE to confirm');
 });
 it('fails closed if role lookup fails',async()=>{
  vi.mocked(supabase).mockResolvedValue(fakeClient(null,true) as never);
  const html=renderToStaticMarkup(await Workspace({searchParams:Promise.resolve({})}));expect(html).toContain('role could not be verified');expect(html).not.toContain('Approve exact change');
 });
});
