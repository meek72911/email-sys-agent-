import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { inngest } from './client';
const id=z.uuid();
/** The worker never trusts event payload as authorization; its RPC rechecks the stored job and roles. */
export const runSandboxJob=inngest.createFunction(
 {id:'relay-sandbox-action',retries:4,idempotency:'event.data.jobId',triggers:{event:'relay/sandbox.action.queued'}},
 async ({event,step})=>{
  const jobId=id.parse(event.data.jobId);
  return step.run('commit-sandbox-action',async()=>{
   const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
   if(!url||!secret)throw new Error('Worker database is not configured');
   const client=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
   // The database transaction is idempotent: a repeat returns the previously committed job state.
   const {data,error}=await client.rpc('relay_run_action_job',{p_job:jobId});
   if(error)throw new Error('Worker could not determine job outcome');
   if(data!=='succeeded'&&data!=='failed')throw new Error('Worker received an unknown job state');
   return {state:data,jobId};
  });
 }
);
