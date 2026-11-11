import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { DispatchRecord, ProviderResult, SandboxProvider } from './reconciliation';
const payloadSchema=z.strictObject({actionId:z.uuid(),orgId:z.uuid(),ticketId:z.uuid(),fromStatus:z.enum(['open','pending','resolved']),toStatus:z.enum(['open','pending','resolved'])});
type Payload=z.infer<typeof payloadSchema>;
export function hashSandboxPayload(p:Payload){return createHash('sha256').update(JSON.stringify([p.actionId,p.orgId,p.ticketId,p.fromStatus,p.toStatus])).digest('hex');}
/** Loopback only. A remote deployment requires a separately reviewed allowlist and transport. */
export function createHttpSandboxProvider(config:{baseUrl:string;token:string;loadPayload:(id:string)=>Promise<unknown>;fetcher?:typeof fetch}):SandboxProvider {
 const url=new URL(config.baseUrl);
 if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('Only the configured loopback sandbox is permitted');
 if(config.token.length<32)throw new Error('Sandbox token is missing or too short');
 const request=config.fetcher??fetch;
 async function payloadFor(id:string){const p=payloadSchema.parse(await config.loadPayload(id));if(p.actionId!==id||p.fromStatus===p.toStatus)throw Error('Invalid approved payload');return p;}
 async function call(path:string,method:'GET'|'POST',body?:Payload):Promise<ProviderResult>{
  const res=await request(new URL(path,url),{method,headers:{authorization:`Bearer ${config.token}`,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000)});
  if(!res.ok)return {status:'unknown'};
  const parsed=z.strictObject({state:z.enum(['succeeded','failed']),payloadHash:z.string().regex(/^[a-f0-9]{64}$/)}).safeParse(await res.json());
  return parsed.success?{status:parsed.data.state,payloadHash:parsed.data.payloadHash}:{status:'unknown'};
 }
 return {
  async send(action:DispatchRecord){
   const p=await payloadFor(action.id);if(hashSandboxPayload(p)!==action.payloadHash)throw Error('Approved payload changed');
   // This endpoint initializes synthetic fixtures only. If its response is lost,
   // reconciliation remains unknown; the claimed action is never resent blindly.
   const created=await request(new URL('/tickets',url),{method:'POST',headers:{authorization:`Bearer ${config.token}`,'content-type':'application/json'},body:JSON.stringify({orgId:p.orgId,ticketId:p.ticketId}),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000)});
   if(!created.ok)throw Error('Sandbox ticket unavailable');
   return call('/actions','POST',p);
  },
  async lookup(id:string){const p=await payloadFor(id);return call(`/receipts/${encodeURIComponent(id)}?orgId=${encodeURIComponent(p.orgId)}`,'GET');},
 };
}
