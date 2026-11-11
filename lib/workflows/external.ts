import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { inngest } from './client';
import { createPersistentDispatchStore } from '@/lib/crm/dispatch-store';
import { createHttpSandboxProvider } from '@/lib/crm/http-sandbox';
import { dispatchOnce,reconcile } from '@/lib/crm/reconciliation';
const id=z.uuid();
function externalDependencies(){
 if(process.env.RELAY_ENABLE_EXTERNAL_SANDBOX!=='true')throw Error('External sandbox disabled');
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY,baseUrl=process.env.SANDBOX_CRM_URL,token=process.env.SANDBOX_CRM_TOKEN;
 if(!url||!secret||!baseUrl||!token)throw Error('External sandbox is not configured');
 const client=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {store,loadPayload}=createPersistentDispatchStore(client);
 return {store,provider:createHttpSandboxProvider({baseUrl,token,loadPayload})};
}
/** Sends only after the database atomically claims an approved and still-authorized action. */
export const runExternalSandboxAction=inngest.createFunction(
 {id:'relay-external-sandbox-action',retries:4,idempotency:'event.data.actionId',triggers:{event:'relay/external.action.queued'}},
 async ({event,step})=>{
  const actionId=id.parse(event.data.actionId);
  return step.run('dispatch-or-reconcile',async()=>{const {store,provider}=externalDependencies();return {state:await dispatchOnce(store,provider,actionId),actionId};});
 }
);
/** Separate event for manual status checks; this function cannot send a write. */
export const reconcileExternalSandboxAction=inngest.createFunction(
 {id:'relay-external-sandbox-reconcile',retries:4,triggers:{event:'relay/external.action.reconcile'}},
 async ({event,step})=>{
  const actionId=id.parse(event.data.actionId);
  return step.run('reconcile-only',async()=>{const {store,provider}=externalDependencies();return {state:await reconcile(store,provider,actionId),actionId};});
 }
);
