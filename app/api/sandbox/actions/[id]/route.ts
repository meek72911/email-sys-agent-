import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createDatabaseCrm } from '@/lib/crm/database';
import { callSandboxMcp } from '@/lib/crm/mcp';
import { idSchema } from '@/lib/crm/gateway';

type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,{params}:Context){
 const id=idSchema.safeParse((await params).id);if(!id.success)return NextResponse.json({error:'Invalid action'}, {status:400});
 const client=await supabase();const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)return NextResponse.json({error:'Authentication required'},{status:401});
 const {data,error}=await client.from('crm_actions').select('id,case_id,from_status,to_status,state,approved_at,executed_at').eq('id',id.data).maybeSingle();
 if(error||!data)return NextResponse.json({error:'Action unavailable'},{status:404});
 return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request,{params}:Context){
 const origin=request.headers.get('origin');if(!origin||origin!==new URL(request.url).origin)return NextResponse.json({error:'Origin denied'},{status:403});
 const id=idSchema.safeParse((await params).id);if(!id.success)return NextResponse.json({error:'Invalid action'},{status:400});
 const client=await supabase();const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)return NextResponse.json({error:'Authentication required'},{status:401});
 try {const result=await callSandboxMcp(createDatabaseCrm(client),'update_ticket_status',{actionId:id.data});return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});}
 catch {return NextResponse.json({error:'Action not executed. Check authorization, approval, and current state.'},{status:409});}
}
