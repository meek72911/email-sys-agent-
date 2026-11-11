import { createHash,randomBytes,timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
export const GMAIL_READONLY_SCOPE='https://www.googleapis.com/auth/gmail.readonly';
const AUTH_URL='https://accounts.google.com/o/oauth2/v2/auth';
const CALLBACK_PATH='/api/connections/gmail/callback';
const stateSchema=z.strictObject({state:z.string().regex(/^[A-Za-z0-9_-]{43}$/),verifier:z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),userId:z.uuid(),orgId:z.uuid(),issuedAt:z.number().int(),expiresAt:z.number().int()});
export type OAuthState=z.infer<typeof stateSchema>;
export function validateCallbackUrl(raw:string,allowLocal=false):string{
 const url=new URL(raw);const local=url.hostname==='127.0.0.1'||url.hostname==='localhost';
 if(url.username||url.password||url.pathname!==CALLBACK_PATH||url.search||url.hash||!(url.protocol==='https:'||(allowLocal&&local&&url.protocol==='http:')))throw Error('Invalid Gmail callback URL');
 return url.href;
}
export function newOAuthState(userId:string,orgId:string,now=Date.now()):OAuthState{
 return stateSchema.parse({state:randomBytes(32).toString('base64url'),verifier:randomBytes(64).toString('base64url'),userId,orgId,issuedAt:now,expiresAt:now+10*60*1000});
}
export function stateDigest(state:string){return createHash('sha256').update(state,'utf8').digest('hex');}
export function verifyOAuthState(value:unknown,returnedState:string,userId:string,orgId:string,now=Date.now()):OAuthState{
 if(!/^[A-Za-z0-9_-]{43}$/.test(returnedState))throw Error('Invalid or expired OAuth state');
 const data=stateSchema.parse(value);const expected=Buffer.from(stateDigest(data.state),'hex'),received=Buffer.from(stateDigest(returnedState),'hex');
 if(!timingSafeEqual(expected,received)||data.userId!==userId||data.orgId!==orgId||data.issuedAt>now||data.expiresAt<=now||data.expiresAt-data.issuedAt>600000)throw Error('Invalid or expired OAuth state');
 return data;
}
export function buildAuthorizationUrl(config:{clientId:string;callbackUrl:string;allowLocal?:boolean},state:OAuthState):string{
 if(!config.clientId||config.clientId.length>500)throw Error('Invalid Google client ID');
 const url=new URL(AUTH_URL);url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:validateCallbackUrl(config.callbackUrl,config.allowLocal),response_type:'code',scope:GMAIL_READONLY_SCOPE,access_type:'offline',prompt:'consent',state:state.state,code_challenge:createHash('sha256').update(state.verifier).digest('base64url'),code_challenge_method:'S256'}).toString();return url.href;
}
