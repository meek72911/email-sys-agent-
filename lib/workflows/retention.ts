import { createClient } from '@supabase/supabase-js';
import { inngest } from './client';
import { durableJobsEnabled } from './config';
/** Periodic cleanup of expired Gmail-derived cases. Requires the disabled worker to be configured. */
export const purgeExpiredGmail=inngest.createFunction(
 {id:'relay-purge-expired-gmail',triggers:{cron:'15 * * * *'}},
 async ({step})=>step.run('purge-expired-cases',async()=>{
  if(!durableJobsEnabled()||process.env.RELAY_ENABLE_GMAIL_IMPORT!=='true')return {state:'disabled'};
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw Error('Retention worker not configured');
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await admin.rpc('relay_purge_expired_gmail_cases');if(error||typeof data!=='number')throw Error('Retention cleanup failed');
  return {state:'completed',removed:data};
 })
);
