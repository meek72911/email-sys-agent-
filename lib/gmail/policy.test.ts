import { describe,expect,it,vi } from 'vitest';
import { Client } from '@modelcontextprotocol/client';
import { McpServer,InMemoryTransport } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { createGmailReadAdapter } from './policy';
import { createPinnedGmailFetch } from './client';
const allowed={authorizeSearch:async()=>true,authorizeSelectedMessage:async(id:string)=>id==='selected',authorizeSelectedThread:async()=>false};
describe('Gmail read policy',()=>{
 it('uses documented bounded read tools with a first-party SDK client',async()=>{
  const server=new McpServer({name:'fake-gmail',version:'1'});const called=vi.fn();
  server.registerTool('get_message',{inputSchema:z.object({messageId:z.string(),messageFormat:z.literal('FULL_CONTENT')})},async args=>{called(args);return {content:[{type:'text' as const,text:'synthetic'}]};});
  server.registerTool('create_draft',{inputSchema:z.object({})},async()=>{throw Error('must not run');});
  const client=new Client({name:'test',version:'1'});const [a,b]=InMemoryTransport.createLinkedPair();
  try{await Promise.all([client.connect(a),server.connect(b)]);const adapter=createGmailReadAdapter(client,allowed);await adapter.getMessage('selected');expect(called).toHaveBeenCalledWith({messageId:'selected',messageFormat:'FULL_CONTENT'});expect(Object.keys(adapter).sort()).toEqual(['getMessage','getThread','search']);}
  finally{await Promise.allSettled([client.close(),server.close()]);}
 });
 it('denies unselected, unauthorized, or malformed requests before calling a tool',async()=>{
  const callTool=vi.fn(async()=>({content:[]}));const adapter=createGmailReadAdapter({callTool},allowed);
  await expect(adapter.getMessage('not-selected')).rejects.toThrow(/not selected/);
  await expect(adapter.getThread('thread-1')).rejects.toThrow(/not selected/);
  await expect(adapter.search(' '.repeat(2))).rejects.toThrow();
  await expect(adapter.getMessage('../metadata')).rejects.toThrow();
  await expect(createGmailReadAdapter({callTool},{...allowed,authorizeSearch:async()=>false}).search('invoice')).rejects.toThrow(/not authorized/);
  expect(callTool).not.toHaveBeenCalled();
 });
 it('does not allow other destinations or redirects and limits oversized responses',async()=>{
  const upstream=vi.fn<typeof fetch>(async()=>new Response('ok',{status:200}));const pinned=createPinnedGmailFetch(upstream as typeof fetch);
  await expect(pinned('https://evil.example/mcp/v1',{headers:{authorization:'Bearer secret'}})).rejects.toThrow(/destination denied/);expect(upstream).not.toHaveBeenCalled();
  await pinned('https://gmailmcp.googleapis.com/mcp/v1');expect(upstream.mock.calls[0][1]).toMatchObject({redirect:'error',credentials:'omit'});
  const large=createPinnedGmailFetch(vi.fn(async()=>new Response('x'.repeat(512*1024+1))) as typeof fetch);
  const response=await large('https://gmailmcp.googleapis.com/mcp/v1');await expect(response.text()).rejects.toThrow(/exceeds limit/);
 });
});
