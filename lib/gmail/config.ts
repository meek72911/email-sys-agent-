import { validateCallbackUrl } from './oauth';
export type GmailConfig={clientId:string;clientSecret:string;callbackUrl:string;key:string;supabaseUrl:string;serviceKey:string;allowLocal:boolean};
export function gmailConfig(requireEnabled=true):GmailConfig|null{
 if(requireEnabled&&(process.env.RELAY_ENABLE_GMAIL!=='true'||process.env.GMAIL_ACCESS_REVIEWED!=='true'))return null;
 const clientId=process.env.GOOGLE_OAUTH_CLIENT_ID,clientSecret=process.env.GOOGLE_OAUTH_CLIENT_SECRET,raw=process.env.GOOGLE_OAUTH_CALLBACK_URL,key=process.env.GMAIL_CREDENTIAL_ENCRYPTION_KEY,supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!clientId||!clientSecret||!raw||!key||!supabaseUrl||!serviceKey||!/^[A-Za-z0-9+/]{43}=$/.test(key)||Buffer.from(key,'base64').length!==32)return null;
 const allowLocal=process.env.NODE_ENV!=='production';
 try{return {clientId,clientSecret,callbackUrl:validateCallbackUrl(raw,allowLocal),key,supabaseUrl,serviceKey,allowLocal};}catch{return null;}
}
export const GMAIL_COOKIE='relay-gmail-oauth';
export const GMAIL_COOKIE_PATH='/api/connections/gmail/callback';
export function sameAppOrigin(request:Request,config:GmailConfig):boolean{
 try{return new URL(request.url).origin===new URL(config.callbackUrl).origin&&request.headers.get('origin')===new URL(config.callbackUrl).origin;}catch{return false;}
}
