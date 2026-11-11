import { createServerClient } from '@supabase/ssr';
import type { CrmGateway } from './gateway';
type Client = ReturnType<typeof createServerClient>;
/** The client carries the verified user's session; RLS and RPC enforce workspace membership. */
export function createDatabaseCrm(client:Client):CrmGateway {
 return {
  async getCustomer(caseId){const {data,error}=await client.from('cases').select('id,customer').eq('id',caseId).maybeSingle();if(error||!data)throw new Error('Customer unavailable');return data;},
  async findTicket(caseId){const {data,error}=await client.from('cases').select('id,ticket_status').eq('id',caseId).maybeSingle();if(error||!data)throw new Error('Ticket unavailable');return data;},
  async executeApprovedAction(actionId){const {data,error}=await client.rpc('relay_execute_status',{p_action:actionId});if(error||data!=='succeeded')throw new Error('Action not executed');return {state:'succeeded',actionId};},
 };
}
