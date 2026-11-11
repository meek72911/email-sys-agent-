import { describe,expect,it,vi } from 'vitest';
import { openGmailMcp } from './client';
describe('Gmail MCP HTTP transport',()=>{
 it('sends the bearer token only to the pinned Google endpoint and closes cleanly',async()=>{
  const requests:{url:string;auth:string|null;redirect:RequestRedirect|undefined;method:string}[]=[];
  const upstream=vi.fn<typeof fetch>(async(input,init)=>{
   const url=input instanceof Request?input.url:String(input);const headers=new Headers(init?.headers);const method=init?.method??'GET';requests.push({url,auth:headers.get('authorization'),redirect:init?.redirect,method});
   if(method==='POST'){
    const msg=JSON.parse(String(init?.body));
    if(msg.method==='initialize')return Response.json({jsonrpc:'2.0',id:msg.id,result:{protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'fake-google',version:'1'}}});
    if(msg.method==='tools/call')return Response.json({jsonrpc:'2.0',id:msg.id,result:{content:[{type:'text',text:'{"id":"msg1","plaintextBody":"synthetic"}'}]}});
    return new Response(null,{status:202});
   }
   return new Response(null,{status:405});
  });
  const client=await openGmailMcp('synthetic-token',upstream);
  try{const result=await client.callTool({name:'get_message',arguments:{messageId:'msg1',messageFormat:'FULL_CONTENT'}});expect(result.isError).not.toBe(true);}finally{await client.close();}
  expect(requests.length).toBeGreaterThanOrEqual(2);expect(requests.every(request=>request.url==='https://gmailmcp.googleapis.com/mcp/v1'&&request.auth==='Bearer synthetic-token'&&request.redirect==='error')).toBe(true);
 });
});
