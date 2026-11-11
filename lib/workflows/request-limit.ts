// Bound the raw payload before the workflow SDK parses it. Request.clone preserves
// the exact bytes and headers used later by Inngest's signature verification.
export async function workflowPayloadWithinLimit(request:Request,limit=256*1024):Promise<boolean>{
 const raw=request.headers.get('content-length');
 if(raw!==null){if(!/^\d+$/.test(raw)||Number(raw)>limit)return false;}
 if(!request.body)return true;
 const reader=request.clone().body?.getReader();if(!reader)return true;
 let total=0;
 try{while(true){const {done,value}=await reader.read();if(done)return true;total+=value.byteLength;if(total>limit){void reader.cancel().catch(()=>{});return false;}}}
 catch{return false;}
 finally{reader.releaseLock();}
}
