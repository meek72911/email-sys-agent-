import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { createCredentialVault } from '@/lib/gmail/vault';
import { gmailConfig,sameAppOrigin } from '@/lib/gmail/config';
export async function POST(request:Request){
 // Disconnect remains possible when the feature flag is off, provided secrets remain configured.
 const config=gmailConfig(false);if(!config)return NextResponse.json({error:'Gmail credential configuration unavailable'},{status:503});
 if(!sameAppOrigin(request,config))return NextResponse.json({error:'Origin denied'},{status:403});
 const client=await supabase();const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)return NextResponse.json({error:'Authentication required'},{status:401});
 const {data:member,error:memberError}=await client.from('memberships').select('org_id,role').eq('user_id',user.id).maybeSingle();if(memberError||!member||member.role!=='owner')return NextResponse.json({error:'Owner access required'},{status:403});
 try{
  const admin=createClient(config.supabaseUrl,config.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const vault=createCredentialVault(client,admin,{key:config.key,userId:user.id,orgId:member.org_id,clientId:config.clientId,clientSecret:config.clientSecret});
  const result=await vault.disconnect();return NextResponse.redirect(new URL('/connections?gmail='+result,config.callbackUrl),{status:303,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 }catch{return NextResponse.redirect(new URL('/connections?gmail=disconnect_failed',config.callbackUrl),{status:303,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});}
}
