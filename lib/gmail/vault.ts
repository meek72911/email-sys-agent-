import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { seal,unseal } from './crypto';
import { GMAIL_READONLY_SCOPE } from './oauth';
import { refreshGoogleTokens,revokeGoogleToken,type GoogleTokens } from './tokens';
const credential=z.strictObject({accessToken:z.string().min(1).max(8192),refreshToken:z.string().min(1).max(8192),expiresAt:z.number().int().positive(),scope:z.literal(GMAIL_READONLY_SCOPE)});
const record=z.object({ciphertext:z.string().nullable(),status:z.enum(['active','revocation_pending','disconnected']),version:z.number().int().positive()});
function context(orgId:string,userId:string){return `gmail:${z.uuid().parse(orgId)}:${z.uuid().parse(userId)}`;}
function encrypted(tokens:GoogleTokens,key:string,orgId:string,userId:string){return seal(credential.parse(tokens),key,context(orgId,userId));}
function decrypted(ciphertext:string,key:string,orgId:string,userId:string){return credential.parse(unseal(ciphertext,key,context(orgId,userId)));}
/** The user client carries a verified session; the admin client must stay server-only. */
export function createCredentialVault(user:SupabaseClient,admin:SupabaseClient,config:{key:string;userId:string;orgId:string;clientId:string;clientSecret:string}){
 const {key,userId,orgId}=config;context(orgId,userId);
 async function getRecord(){const {data,error}=await user.rpc('relay_get_gmail_credential',{p_org:orgId});if(error)throw Error('Gmail credential unavailable');return data?record.parse(data):null;}
 async function getActive(){const current=await getRecord();if(!current||current.status!=='active'||!current.ciphertext)throw Error('Gmail is not active');return {tokens:decrypted(current.ciphertext,key,orgId,userId),version:current.version};}
 return {
  async storeAfterOAuth(attemptId:string,tokens:GoogleTokens){
   const safe=credential.parse(tokens);const {error}=await user.rpc('relay_store_gmail_credential',{p_attempt:z.uuid().parse(attemptId),p_ciphertext:encrypted(safe,key,orgId,userId),p_expires:new Date(safe.expiresAt).toISOString(),p_scope:safe.scope});
   if(error)throw Error('Gmail credential could not be stored');
  },
  getActive,
  async refresh(upstream:typeof fetch=fetch){
   const current=await getActive();const next=await refreshGoogleTokens(config,current.tokens,upstream);
   const {data,error}=await user.rpc('relay_refresh_gmail_credential',{p_org:orgId,p_version:current.version,p_ciphertext:encrypted(next,key,orgId,userId),p_expires:new Date(next.expiresAt).toISOString()});
   // A concurrent disconnect or refresh invalidates the in-flight token.
   if(error||data!==true)throw Error('Gmail credential changed during refresh');
   return next;
  },
  async disconnect(upstream:typeof fetch=fetch):Promise<'disconnected'|'revocation_pending'>{
   const {data,error}=await user.rpc('relay_begin_gmail_disconnect',{p_org:orgId});if(error)throw Error('Could not disconnect Gmail');if(!data)return 'disconnected';
   const pending=record.parse(data);if(pending.status!=='revocation_pending'||!pending.ciphertext)throw Error('Invalid Gmail revocation state');
   const tokens=decrypted(pending.ciphertext,key,orgId,userId);
   if(!(await revokeGoogleToken(tokens.refreshToken,upstream)))return 'revocation_pending';
   const finish=await admin.rpc('relay_finish_gmail_disconnect',{p_org:orgId,p_version:pending.version});
   return !finish.error&&finish.data===true?'disconnected':'revocation_pending';
  },
 };
}
