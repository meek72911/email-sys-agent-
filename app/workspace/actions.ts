"use server";
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { createDatabaseCrm } from '@/lib/crm/database';
import { callSandboxMcp } from '@/lib/crm/mcp';
import { inngest } from '@/lib/workflows/client';
import { durableJobsEnabled } from '@/lib/workflows/config';
import { z } from 'zod';
async function clientForUser() {
  const client = await supabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/login');
  return client;
}
function back(caseId: string, error?: string): never {
  revalidatePath('/workspace');
  redirect('/workspace?case=' + encodeURIComponent(caseId) + (error ? '&error=' + encodeURIComponent(error) : ''));
}
export async function createWorkspace() {
  const client = await clientForUser();
  const { error } = await client.rpc('create_relay_workspace');
  if (error) redirect('/workspace?error=setup');
  revalidatePath('/workspace');
  redirect('/workspace');
}
export async function saveDraft(form: FormData) {
  const caseId=String(form.get('caseId') ?? ''); const draft=String(form.get('draft') ?? '');
  const client=await clientForUser();
  const {error}=await client.rpc('relay_save_draft',{p_case:caseId,p_draft:draft});
  back(caseId,error ? 'Could not save draft. Check your role and database setup.' : undefined);
}
async function reviewSavedDraft(form:FormData,decision:'approved'|'rejected') {
  const caseId=String(form.get('caseId') ?? ''); const client=await clientForUser();
  const {error}=await client.rpc('relay_review_draft',{p_case:caseId,p_draft:String(form.get('draft') ?? ''),p_decision:decision});
  back(caseId,error ? 'Draft review failed. Save your current changes first and check your access.' : undefined);
}
export async function approveDraft(form:FormData){return reviewSavedDraft(form,'approved');}
export async function rejectDraft(form:FormData){return reviewSavedDraft(form,'rejected');}
/** Fetch again immediately before copying so a stale page cannot export an old approval. */
export async function getApprovedDraft(caseId:string,expected:string):Promise<{ok:true;draft:string}|{ok:false}>{
 const id=z.uuid().safeParse(caseId);if(!id.success||typeof expected!=='string'||!expected.trim()||expected.length>5000)return {ok:false};
 const client=await clientForUser();const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)return {ok:false};
 const {data:membership,error:memberError}=await client.from('memberships').select('org_id,role').eq('user_id',user.id).maybeSingle();
 if(memberError||!membership||!['owner','operator'].includes(membership.role))return {ok:false};
 const {data:record,error}=await client.from('cases').select('draft,draft_review_state,draft_review_revision,organizations(knowledge_revision)').eq('id',id.data).eq('org_id',membership.org_id).maybeSingle();
 if(error||!record)return {ok:false};const org=Array.isArray(record.organizations)?record.organizations[0]:record.organizations;
 if(record.draft!==expected||record.draft_review_state!=='approved'||typeof org?.knowledge_revision!=='number'||record.draft_review_revision!==org.knowledge_revision)return {ok:false};
 return {ok:true,draft:record.draft};
}
export async function propose(form: FormData) {
  const caseId=String(form.get('caseId') ?? ''); const status=String(form.get('status') ?? '');
  const client=await clientForUser();
  const {error}=await client.rpc('relay_propose_status',{p_case:caseId,p_status:status});
  back(caseId,error ? 'Could not propose this change. Check the current status and your role.' : undefined);
}
export async function approve(form: FormData) {
  const caseId=String(form.get('caseId') ?? ''); const client=await clientForUser();
  const {error}=await client.rpc('relay_approve_status',{p_action:String(form.get('actionId') ?? ''),p_from:String(form.get('from') ?? ''),p_to:String(form.get('to') ?? '')});
  back(caseId,error ? 'Approval failed. The action or ticket may have changed.' : undefined);
}
export async function reject(form: FormData) {
  const caseId=String(form.get('caseId') ?? ''); const client=await clientForUser();
  const {error}=await client.rpc('relay_reject_status',{p_action:String(form.get('actionId') ?? ''),p_from:String(form.get('from') ?? ''),p_to:String(form.get('to') ?? '')});
  back(caseId,error ? 'Rejection failed. The action may have changed or your role may not permit it.' : undefined);
}
export async function execute(form: FormData) {
  const caseId=String(form.get('caseId') ?? ''); const client=await clientForUser();
  let failed = false;
  try { await callSandboxMcp(createDatabaseCrm(client),'update_ticket_status',{actionId:String(form.get('actionId') ?? '')}); } catch { failed=true; }
  back(caseId,failed ? 'Execution failed. No success has been reported; review the action and current status.' : undefined);
}

export async function enqueueExecution(form:FormData) {
  const caseId=String(form.get('caseId') ?? '');
  const action=z.uuid().safeParse(form.get('actionId'));
  if(!action.success) back(caseId,'Invalid action.');
  if(!durableJobsEnabled() || !process.env.SUPABASE_SERVICE_ROLE_KEY) back(caseId,'Background execution is not configured.');
  const client=await clientForUser();
  const {data:jobId,error}=await client.rpc('relay_enqueue_action',{p_action:action.data});
  if(error || !jobId) back(caseId,'Could not queue this action. Check approval and your role.');
  try {await inngest.send({id:jobId,name:'relay/sandbox.action.queued',data:{jobId}});}
  catch {back(caseId,'The job is queued, but dispatch could not be confirmed. Use Queue again to retry dispatch.');}
  back(caseId);
}
export async function queueExternalSandbox(form:FormData) {
 const caseId=String(form.get('caseId')??'');const action=z.uuid().safeParse(form.get('actionId'));
 if(!action.success)back(caseId,'Invalid action.');
 if(!durableJobsEnabled()||process.env.RELAY_ENABLE_EXTERNAL_SANDBOX!=='true'||!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.SANDBOX_CRM_URL||!process.env.SANDBOX_CRM_TOKEN)back(caseId,'External sandbox execution is not configured.');
 const client=await clientForUser();
 const {data:id,error}=await client.rpc('relay_prepare_external_dispatch',{p_action:action.data});
 if(error||!id)back(caseId,'Could not prepare external sandbox dispatch. Check approval and current evidence.');
 try{await inngest.send({id,name:'relay/external.action.queued',data:{actionId:id}});}
 catch{back(caseId,'Dispatch is queued, but delivery could not be confirmed. Do not assume success.');}
 back(caseId);
}
export async function checkExternalSandbox(form:FormData) {
 const caseId=String(form.get('caseId')??'');const action=z.uuid().safeParse(form.get('actionId'));
 if(!action.success)back(caseId,'Invalid action.');
 if(!durableJobsEnabled()||process.env.RELAY_ENABLE_EXTERNAL_SANDBOX!=='true'||!process.env.SUPABASE_SERVICE_ROLE_KEY)back(caseId,'External sandbox execution is not configured.');
 const client=await clientForUser();const {data:{user}}=await client.auth.getUser();
 const {data:dispatch}=await client.from('external_dispatches').select('org_id,case_id,state').eq('id',action.data).maybeSingle();
 if(!user||!dispatch||dispatch.case_id!==caseId||!['dispatching','needs_reconciliation'].includes(dispatch.state))back(caseId,'No uncertain dispatch is available to check.');
 const {data:member}=await client.from('memberships').select('role').eq('org_id',dispatch.org_id).eq('user_id',user.id).maybeSingle();
 if(!member||!['owner','operator'].includes(member.role))back(caseId,'Your role cannot request reconciliation.');
 try{await inngest.send({name:'relay/external.action.reconcile',data:{actionId:action.data}});}
 catch{back(caseId,'The status check could not be requested. The result remains uncertain.');}
 back(caseId);
}
