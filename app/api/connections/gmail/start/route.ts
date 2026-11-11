import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { seal } from '@/lib/gmail/crypto';
import { buildAuthorizationUrl,newOAuthState,stateDigest } from '@/lib/gmail/oauth';
import { gmailConfig,GMAIL_COOKIE,GMAIL_COOKIE_PATH,sameAppOrigin } from '@/lib/gmail/config';
export async function POST(request:Request){
 const config=gmailConfig();if(!config)return NextResponse.json({error:'Gmail connection is disabled or not configured'},{status:503});
 if(!sameAppOrigin(request,config))return NextResponse.json({error:'Origin denied'},{status:403});
 const client=await supabase();const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)return NextResponse.json({error:'Authentication required'},{status:401});
 const {data:member,error:memberError}=await client.from('memberships').select('org_id,role').eq('user_id',user.id).maybeSingle();
 if(memberError||!member||member.role!=='owner')return NextResponse.json({error:'Owner access required'},{status:403});
 try{
  const state=newOAuthState(user.id,member.org_id);const cookie=seal(state,config.key,'gmail-oauth-state');const url=buildAuthorizationUrl(config,state);
  const {error}=await client.rpc('relay_begin_gmail_oauth',{p_org:member.org_id,p_state_hash:stateDigest(state.state)});
  if(error)return NextResponse.json({error:'Could not begin Gmail authorization'},{status:409});
  const response=NextResponse.redirect(url,{status:303,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  response.cookies.set(GMAIL_COOKIE,cookie,{httpOnly:true,secure:new URL(config.callbackUrl).protocol==='https:',sameSite:'lax',path:GMAIL_COOKIE_PATH,maxAge:600});return response;
 }catch{return NextResponse.json({error:'Could not begin Gmail authorization'},{status:503});}
}
