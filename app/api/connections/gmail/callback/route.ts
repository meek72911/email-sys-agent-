import { NextRequest,NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { unseal } from '@/lib/gmail/crypto';
import { verifyOAuthState,stateDigest } from '@/lib/gmail/oauth';
import { exchangeGoogleCode,revokeGoogleToken,type GoogleTokens } from '@/lib/gmail/tokens';
import { createCredentialVault } from '@/lib/gmail/vault';
import { gmailConfig,GMAIL_COOKIE,GMAIL_COOKIE_PATH,type GmailConfig } from '@/lib/gmail/config';
function finish(config:GmailConfig,outcome:'connected'|'denied'|'failed'){
 const response=NextResponse.redirect(new URL('/connections?gmail='+outcome,config.callbackUrl),{status:303,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 response.cookies.set(GMAIL_COOKIE,'',{httpOnly:true,secure:new URL(config.callbackUrl).protocol==='https:',sameSite:'lax',path:GMAIL_COOKIE_PATH,maxAge:0});return response;
}
export async function GET(request:NextRequest){
 const config=gmailConfig();if(!config)return NextResponse.json({error:'Gmail connection is disabled or not configured'},{status:503});
 if(new URL(request.url).origin!==new URL(config.callbackUrl).origin)return NextResponse.json({error:'Origin denied'},{status:403});
 const url=new URL(request.url),code=url.searchParams.get('code'),returnedState=url.searchParams.get('state'),cookie=request.cookies.get(GMAIL_COOKIE)?.value;
 if(url.searchParams.has('error'))return finish(config,'denied');
 if(!code||!returnedState||!cookie)return finish(config,'failed');
 let tokens:GoogleTokens|undefined;
 try{
  const client=await supabase();const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)return finish(config,'failed');
  const {data:member,error:memberError}=await client.from('memberships').select('org_id,role').eq('user_id',user.id).maybeSingle();
  if(memberError||!member||member.role!=='owner')return finish(config,'failed');
  const state=verifyOAuthState(unseal(cookie,config.key,'gmail-oauth-state'),returnedState,user.id,member.org_id);
  const {data:attempt,error}=await client.rpc('relay_consume_gmail_oauth',{p_state_hash:stateDigest(state.state)});
  if(error||!attempt)return finish(config,'failed');
  tokens=await exchangeGoogleCode(config,code,state.verifier);
  const admin=createClient(config.supabaseUrl,config.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const vault=createCredentialVault(client,admin,{key:config.key,userId:user.id,orgId:member.org_id,clientId:config.clientId,clientSecret:config.clientSecret});
  await vault.storeAfterOAuth(attempt,tokens);return finish(config,'connected');
 }catch{
  // If a token was issued but not stored, attempt remote revocation; the result may be unknown.
  if(tokens)await revokeGoogleToken(tokens.refreshToken);
  return finish(config,'failed');
 }
}
