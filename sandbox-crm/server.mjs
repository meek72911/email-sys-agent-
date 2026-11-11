import http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statusSet=new Set(['open','pending','resolved']);
const sameKeys=(object,keys)=>object && typeof object==='object' && !Array.isArray(object) && Object.keys(object).sort().join(',')===[...keys].sort().join(',');
const validId=value=>typeof value==='string' && idPattern.test(value);
export const hashPayload=payload=>createHash('sha256').update(JSON.stringify([payload.actionId,payload.orgId,payload.ticketId,payload.fromStatus,payload.toStatus])).digest('hex');
function equalSecret(expected,header){const actual=String(header??'');const a=Buffer.from(`Bearer ${expected}`),b=Buffer.from(actual);return a.length===b.length&&timingSafeEqual(a,b);}
function json(res,status,data){res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));}
async function readJson(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>8192)throw Error('Body too large');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}

/** Local-only synthetic service. The bearer token is shared only with the trusted Relay backend. */
export function createSandboxServer({token,dbPath=':memory:'}){
 if(typeof token!=='string'||token.length<32)throw Error('A sandbox token of at least 32 characters is required');
 const db=new DatabaseSync(dbPath);db.exec(`PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS tickets (org_id TEXT NOT NULL,id TEXT NOT NULL,status TEXT NOT NULL,PRIMARY KEY(org_id,id)); CREATE TABLE IF NOT EXISTS receipts (action_id TEXT PRIMARY KEY,org_id TEXT NOT NULL,payload_hash TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('succeeded','failed')),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
 const server=http.createServer(async(req,res)=>{
  try {
   if(!equalSecret(token,req.headers.authorization))return json(res,401,{error:'Unauthorized'});
   const host=String(req.headers.host??'');if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host))return json(res,403,{error:'Host denied'});
   const url=new URL(req.url,'http://127.0.0.1');
   if(req.method==='POST'&&url.pathname==='/tickets'){
    const input=await readJson(req);if(!sameKeys(input,['orgId','ticketId'])||!validId(input.orgId)||!validId(input.ticketId))return json(res,400,{error:'Invalid request'});
    db.prepare("INSERT INTO tickets(org_id,id,status) VALUES(?,?,'open') ON CONFLICT(org_id,id) DO NOTHING").run(input.orgId,input.ticketId);
    const row=db.prepare('SELECT id,status FROM tickets WHERE org_id=? AND id=?').get(input.orgId,input.ticketId);return json(res,200,row);
   }
   const ticketMatch=url.pathname.match(/^\/tickets\/([^/]+)$/);
   if(req.method==='GET'&&ticketMatch){const org=url.searchParams.get('orgId');if(!validId(org)||!validId(ticketMatch[1]))return json(res,400,{error:'Invalid request'});const row=db.prepare('SELECT id,status FROM tickets WHERE org_id=? AND id=?').get(org,ticketMatch[1]);return row?json(res,200,row):json(res,404,{error:'Ticket unavailable'});}
   const receiptMatch=url.pathname.match(/^\/receipts\/([^/]+)$/);
   if(req.method==='GET'&&receiptMatch){const org=url.searchParams.get('orgId');if(!validId(org)||!validId(receiptMatch[1]))return json(res,400,{error:'Invalid request'});const row=db.prepare('SELECT state,payload_hash AS payloadHash FROM receipts WHERE org_id=? AND action_id=?').get(org,receiptMatch[1]);return row?json(res,200,row):json(res,404,{error:'Receipt unavailable'});}
   if(req.method==='POST'&&url.pathname==='/actions'){
    const x=await readJson(req);if(!sameKeys(x,['actionId','orgId','ticketId','fromStatus','toStatus'])||![x.actionId,x.orgId,x.ticketId].every(validId)||!statusSet.has(x.fromStatus)||!statusSet.has(x.toStatus)||x.fromStatus===x.toStatus)return json(res,400,{error:'Invalid action'});
    const hash=hashPayload(x);db.exec('BEGIN IMMEDIATE');
    try {
     const existing=db.prepare('SELECT org_id,payload_hash,state FROM receipts WHERE action_id=?').get(x.actionId);
     if(existing){db.exec('COMMIT');if(existing.org_id!==x.orgId||existing.payload_hash!==hash)return json(res,409,{error:'Action ID already used'});return json(res,200,{state:existing.state,payloadHash:existing.payload_hash});}
     const changed=db.prepare('UPDATE tickets SET status=? WHERE org_id=? AND id=? AND status=?').run(x.toStatus,x.orgId,x.ticketId,x.fromStatus);
     const state=changed.changes===1?'succeeded':'failed';
     db.prepare('INSERT INTO receipts(action_id,org_id,payload_hash,state) VALUES(?,?,?,?)').run(x.actionId,x.orgId,hash,state);
     db.exec('COMMIT');return json(res,200,{state,payloadHash:hash});
    } catch(error){db.exec('ROLLBACK');throw error;}
   }
   return json(res,404,{error:'Not found'});
  } catch {if(!res.headersSent)json(res,400,{error:'Invalid request'});else res.destroy();}
 });
 server.on('close',()=>db.close());return server;
}
