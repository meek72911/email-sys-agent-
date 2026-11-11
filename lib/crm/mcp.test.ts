import { describe, expect, it, vi } from 'vitest';
import { callSandboxMcp } from './mcp';
import { invokeAllowedTool, type CrmGateway } from './gateway';
const caseId='00000000-0000-4000-8000-000000000001';
const actionId='00000000-0000-4000-8000-000000000002';
function gateway():CrmGateway {return {getCustomer:vi.fn(async id=>({id})),findTicket:vi.fn(async id=>({id,status:'open'})),executeApprovedAction:vi.fn(async id=>({state:'succeeded',actionId:id}))};}
describe('first-party MCP policy boundary',()=>{
 it('uses the SDK client/server transport for allowlisted read and write tools',async()=>{
  const g=gateway();expect(await callSandboxMcp(g,'find_ticket',{caseId})).toEqual({id:caseId,status:'open'});
  expect(await callSandboxMcp(g,'update_ticket_status',{actionId})).toEqual({state:'succeeded',actionId});expect(g.executeApprovedAction).toHaveBeenCalledOnce();
 });
 it('rejects arbitrary tools and extra or malformed arguments before reaching the gateway',async()=>{
  const g=gateway();await expect(callSandboxMcp(g,'delete_customer',{caseId})).rejects.toThrow(/not allowed/);
  await expect(callSandboxMcp(g,'update_ticket_status',{actionId,to:'resolved'})).rejects.toThrow();
  await expect(invokeAllowedTool(g,'update_ticket_status',{actionId:'no'})).rejects.toThrow();
  expect(g.executeApprovedAction).not.toHaveBeenCalled();
 });
 it('never converts an authorization or execution failure into success',async()=>{
  const g=gateway();g.executeApprovedAction=vi.fn(async()=>{throw new Error('Approval required');});
  await expect(callSandboxMcp(g,'update_ticket_status',{actionId})).rejects.toThrow();
 });
});
