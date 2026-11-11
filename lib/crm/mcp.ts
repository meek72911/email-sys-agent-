import { McpServer, InMemoryTransport } from '@modelcontextprotocol/server';
import { Client } from '@modelcontextprotocol/client';
import { z } from 'zod';
import { invokeAllowedTool, toolInputSchemas, toolNames, type CrmGateway } from './gateway';

/** First-party, per-request in-memory server: no remote URL or untrusted server metadata. */
export function createSandboxMcp(gateway:CrmGateway) {
 const server=new McpServer({name:'relay-sandbox-crm',version:'0.1.0'});
 server.registerTool('get_customer',{description:'Read the customer on a case visible to this user.',inputSchema:toolInputSchemas.get_customer},async args=>({content:[{type:'text' as const,text:JSON.stringify(await invokeAllowedTool(gateway,'get_customer',args))}]}));
 server.registerTool('find_ticket',{description:'Read the sandbox ticket on a case visible to this user.',inputSchema:toolInputSchemas.find_ticket},async args=>({content:[{type:'text' as const,text:JSON.stringify(await invokeAllowedTool(gateway,'find_ticket',args))}]}));
 server.registerTool('update_ticket_status',{description:'Execute an existing approved action; the gateway checks authorization and approval.',inputSchema:toolInputSchemas.update_ticket_status},async args=>({content:[{type:'text' as const,text:JSON.stringify(await invokeAllowedTool(gateway,'update_ticket_status',args))}]}));
 return server;
}
export async function callSandboxMcp(gateway:CrmGateway,name:string,args:unknown) {
 if(!toolNames.includes(name as (typeof toolNames)[number]))throw new Error('Tool is not allowed');
 const input=toolInputSchemas[name as keyof typeof toolInputSchemas].parse(args);
 const server=createSandboxMcp(gateway); const client=new Client({name:'relay-policy-gateway',version:'0.1.0'});
 const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
 try {
  await Promise.all([client.connect(clientTransport),server.connect(serverTransport)]);
  const result=await client.callTool({name,arguments:input});
  if(result.isError)throw new Error('Sandbox tool failed');
  const block=result.content.find(x=>x.type==='text');
  if(!block || block.type!=='text')throw new Error('Invalid sandbox result');
  return z.unknown().parse(JSON.parse(block.text));
 } finally {await Promise.allSettled([client.close(),server.close()]);}
}
