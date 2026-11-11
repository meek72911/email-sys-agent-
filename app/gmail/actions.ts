"use server";
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { gmailConfig } from '@/lib/gmail/config';
import { gmailImportEnabled } from '@/lib/gmail/import-config';
import { createCredentialVault } from '@/lib/gmail/vault';
import { openGmailMcp } from '@/lib/gmail/client';
import { createGmailReadAdapter } from '@/lib/gmail/policy';
import { parseSearchResults,parseSelectedMessage,type MailSummary } from '@/lib/gmail/response';
export type SearchState={error?:string;results?:MailSummary[]};
export type ImportState={error?:string;caseId?:string};
async function context(){
 const config=gmailConfig();if(!config||!gmailImportEnabled())throw Error('Disabled');
 const userClient=await supabase();const {data:{user},error}=await userClient.auth.getUser();if(error||!user)throw Error('Authentication required');
 const {data:member,error:membershipError}=await userClient.from('memberships').select('org_id,role').eq('user_id',user.id).maybeSingle();if(membershipError||!member||member.role!=='owner')throw Error('Owner required');
 const admin=createClient(config.supabaseUrl,config.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const vault=createCredentialVault(userClient,admin,{key:config.key,userId:user.id,orgId:member.org_id,clientId:config.clientId,clientSecret:config.clientSecret});
 let active=await vault.getActive();if(active.tokens.expiresAt<=Date.now()+60000){await vault.refresh();active=await vault.getActive();}
 return {userClient,admin,userId:user.id,orgId:member.org_id,token:active.tokens.accessToken};
}
async function adapter(ctx:Awaited<ReturnType<typeof context>>){
 const client=await openGmailMcp(ctx.token);
 return {client,reader:createGmailReadAdapter(client,{
  authorizeSearch:async()=>{const {data,error}=await ctx.userClient.rpc('relay_gmail_status',{p_org:ctx.orgId});return !error&&data==='active';},
  authorizeSelectedMessage:async(id)=>{const {data,error}=await ctx.userClient.rpc('relay_is_gmail_message_selected',{p_org:ctx.orgId,p_message_id:id});return !error&&data===true;},
  authorizeSelectedThread:async()=>false,
 })};
}
export async function searchGmail(_previous:SearchState,form:FormData):Promise<SearchState>{
 const query=z.string().trim().min(1).max(200).safeParse(form.get('query'));if(!query.success)return {error:'Enter a search of up to 200 characters.'};
 try{const ctx=await context();const {client,reader}=await adapter(ctx);try{return {results:parseSearchResults(await reader.search(query.data))};}finally{await client.close();}}catch{return {error:'Gmail search is unavailable. Check the connection and setup.'};}
}
export async function importGmail(_previous:ImportState,form:FormData):Promise<ImportState>{
 const id=z.string().min(1).max(256).regex(/^[A-Za-z0-9_-]+$/).safeParse(form.get('messageId'));if(!id.success)return {error:'Invalid message selection.'};
 try{const ctx=await context();const selection=await ctx.userClient.rpc('relay_select_gmail_message',{p_org:ctx.orgId,p_message_id:id.data});if(selection.error)throw Error('Selection unavailable');
  const {client,reader}=await adapter(ctx);let message;try{message=parseSelectedMessage(await reader.getMessage(id.data),id.data);}finally{await client.close();}
  const {data,error}=await ctx.admin.rpc('relay_import_selected_gmail',{p_org:ctx.orgId,p_user:ctx.userId,p_message_id:message.id,p_subject:message.subject,p_sender:message.sender,p_body:message.body});if(error||!z.uuid().safeParse(data).success)throw Error('Import failed');return {caseId:data};
 }catch{return {error:'The selected message could not be imported. Check the connection and try again.'};}
}
