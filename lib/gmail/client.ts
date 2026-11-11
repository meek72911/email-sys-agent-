import { Client,StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
const ENDPOINT='https://gmailmcp.googleapis.com/mcp/v1';
const MAX_RESPONSE_BYTES=512*1024;
/** Fixed Google destination; redirects and requests to any other URL are denied. */
export function createPinnedGmailFetch(upstream:typeof fetch=fetch):typeof fetch{
 return async(input,init)=>{
  const target=new URL(input instanceof Request?input.url:String(input));
  if(target.href!==ENDPOINT)throw Error('Gmail destination denied');
  const signal=init?.signal?AbortSignal.any([init.signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000);
  const response=await upstream(input,{...init,signal,redirect:'error',credentials:'omit'});
  const size=Number(response.headers.get('content-length'));
  if(Number.isFinite(size)&&size>MAX_RESPONSE_BYTES)throw Error('Gmail response exceeds limit');
  if(!response.body)return response;
  let seen=0;
  const bounded=response.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({transform(chunk,controller){seen+=chunk.byteLength;if(seen>MAX_RESPONSE_BYTES){controller.error(new Error('Gmail response exceeds limit'));return;}controller.enqueue(chunk);}}));
  return new Response(bounded,{status:response.status,statusText:response.statusText,headers:response.headers});
 };
}
/** Internal factory; callers must separately enforce authorization and selection. */
export async function openGmailMcp(accessToken:string,upstream:typeof fetch=fetch){
 if(!accessToken||accessToken.length>8192||/[\r\n]/.test(accessToken))throw Error('Invalid Gmail authorization');
 const client=new Client({name:'relay-gmail-read',version:'0.1.0'});
 const transport=new StreamableHTTPClientTransport(new URL(ENDPOINT),{authProvider:{token:async()=>accessToken},fetch:createPinnedGmailFetch(upstream),requestInit:{redirect:'error'}});
 try{await client.connect(transport);return client;}catch{await client.close();throw Error('Gmail connection failed');}
}
