import { z } from 'zod';
export const gmailReadToolNames=['search_threads','get_message','get_thread'] as const;
type ReadTool=typeof gmailReadToolNames[number];
const messageId=z.string().min(1).max(256).regex(/^[A-Za-z0-9_-]+$/);
const schemas={
 search_threads:z.strictObject({query:z.string().trim().min(1).max(200),pageSize:z.number().int().min(1).max(20),includeTrash:z.literal(false),view:z.literal('THREAD_VIEW_MINIMAL')}),
 get_message:z.strictObject({messageId,messageFormat:z.literal('FULL_CONTENT')}),
 get_thread:z.strictObject({threadId:messageId,messageFormat:z.literal('FULL_CONTENT')}),
};
export interface GmailReadClient {callTool(params:{name:string;arguments:Record<string,unknown>}):Promise<unknown>;}
/** This policy must be implemented by a server-side authorization and selection store. */
export interface GmailReadPolicy {
 authorizeSearch():Promise<boolean>;
 authorizeSelectedMessage(messageId:string):Promise<boolean>;
 authorizeSelectedThread(threadId:string):Promise<boolean>;
}
/** Read-only, explicit user operations. No arbitrary tool names or model-selected calls. */
export function createGmailReadAdapter(client:GmailReadClient,policy:GmailReadPolicy){
 async function invoke(name:ReadTool,args:unknown){
  const validated=schemas[name].parse(args);
  if(name==='search_threads'&&!(await policy.authorizeSearch()))throw Error('Search not authorized');
  if(name==='get_message'&&!(await policy.authorizeSelectedMessage((validated as z.infer<typeof schemas.get_message>).messageId)))throw Error('Message not selected');
  if(name==='get_thread'&&!(await policy.authorizeSelectedThread((validated as z.infer<typeof schemas.get_thread>).threadId)))throw Error('Thread not selected');
  const result=await client.callTool({name,arguments:validated});
  // Treat all connector results and metadata as untrusted data, never instructions.
  if(new TextEncoder().encode(JSON.stringify(result)).length>512*1024)throw Error('Gmail response exceeds limit');
  return result;
 }
 return {
  search:(query:string)=>invoke('search_threads',{query,pageSize:20,includeTrash:false,view:'THREAD_VIEW_MINIMAL'}),
  getMessage:(messageId:string)=>invoke('get_message',{messageId,messageFormat:'FULL_CONTENT'}),
  getThread:(threadId:string)=>invoke('get_thread',{threadId,messageFormat:'FULL_CONTENT'}),
 };
}
