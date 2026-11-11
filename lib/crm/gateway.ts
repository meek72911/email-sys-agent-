import { z } from 'zod';
export const idSchema=z.uuid();
export const toolNames=['get_customer','find_ticket','update_ticket_status'] as const;
export const toolInputSchemas={
 get_customer:z.strictObject({caseId:idSchema}),
 find_ticket:z.strictObject({caseId:idSchema}),
 update_ticket_status:z.strictObject({actionId:idSchema}),
};
export interface CrmGateway {
 getCustomer(caseId:string):Promise<unknown>;
 findTicket(caseId:string):Promise<unknown>;
 executeApprovedAction(actionId:string):Promise<unknown>;
}
export async function invokeAllowedTool(gateway:CrmGateway, name:string, args:unknown):Promise<unknown> {
 switch(name){
  case 'get_customer':return gateway.getCustomer(toolInputSchemas.get_customer.parse(args).caseId);
  case 'find_ticket':return gateway.findTicket(toolInputSchemas.find_ticket.parse(args).caseId);
  case 'update_ticket_status':return gateway.executeApprovedAction(toolInputSchemas.update_ticket_status.parse(args).actionId);
  default:throw new Error('Tool is not allowed');
 }
}
