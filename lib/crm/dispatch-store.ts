import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { DispatchState,DispatchStore } from './reconciliation';
const rowSchema=z.object({id:z.uuid(),org_id:z.uuid(),case_id:z.uuid(),from_status:z.enum(['open','pending','resolved']),to_status:z.enum(['open','pending','resolved']),payload_hash:z.string().regex(/^[a-f0-9]{64}$/),state:z.enum(['queued','dispatching','needs_reconciliation','succeeded','failed'])});
/** Uses a server-only service client; database functions retain the authorization boundary. */
export function createPersistentDispatchStore(client:SupabaseClient){
 async function row(id:string){const {data,error}=await client.from('external_dispatches').select('id,org_id,case_id,from_status,to_status,payload_hash,state').eq('id',id).maybeSingle();if(error)throw Error('Dispatch state unavailable');return data?rowSchema.parse(data):null;}
 const store:DispatchStore={
  async get(id){const d=await row(id);return d?{id:d.id,payloadHash:d.payload_hash,state:d.state}:null;},
  async claim(id){const {data,error}=await client.rpc('relay_claim_external_dispatch',{p_action:id});if(error)throw Error('Dispatch claim failed');if(!data)return null;return z.object({id:z.uuid(),payloadHash:z.string().regex(/^[a-f0-9]{64}$/),state:z.literal('dispatching')}).parse(data);},
  async mark(id,state){const d=await row(id);if(!d)throw Error('Dispatch unavailable');const {data,error}=await client.rpc('relay_mark_external_dispatch',{p_action:id,p_state:state,p_hash:d.payload_hash});if(error)throw Error('Dispatch state could not be recorded');return z.enum(['queued','dispatching','needs_reconciliation','succeeded','failed']).parse(data) as DispatchState;},
 };
 async function loadPayload(id:string){const d=await row(id);if(!d)throw Error('Dispatch unavailable');return {actionId:d.id,orgId:d.org_id,ticketId:d.case_id,fromStatus:d.from_status,toStatus:d.to_status};}
 return {store,loadPayload};
}
