import { z } from 'zod';
import { GMAIL_READONLY_SCOPE,validateCallbackUrl } from './oauth';
const TOKEN_ENDPOINT='https://oauth2.googleapis.com/token';
const REVOKE_ENDPOINT='https://oauth2.googleapis.com/revoke';
const tokenResponse=z.object({access_token:z.string().min(1).max(8192),refresh_token:z.string().min(1).max(8192).optional(),expires_in:z.number().int().min(1).max(86400),scope:z.string().min(1).max(2048).optional(),token_type:z.string().refine(value=>value.toLowerCase()==='bearer')});
export type GoogleTokens={accessToken:string;refreshToken:string;expiresAt:number;scope:string};
async function boundedJson(response:Response):Promise<unknown>{
 if(!response.ok||!response.body)throw Error('Google authorization failed');
 const reader=response.body.getReader();let bytes=0;const chunks:Uint8Array[]=[];
 try {for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>32768){await reader.cancel();throw Error('Google response too large');}chunks.push(value);}}
 finally{reader.releaseLock();}
 const buffer=Buffer.concat(chunks.map(chunk=>Buffer.from(chunk)));try{return JSON.parse(buffer.toString('utf8'));}catch{throw Error('Invalid Google response');}
}
function checkScope(scope:string){const scopes=scope.split(/\s+/).filter(Boolean);if(scopes.length!==1||scopes[0]!==GMAIL_READONLY_SCOPE)throw Error('Unexpected Gmail authorization scope');}
function config(c:{clientId:string;clientSecret:string}){if(!c.clientId||!c.clientSecret||c.clientId.length>500||c.clientSecret.length>1000)throw Error('Google OAuth is not configured');}
async function post(body:URLSearchParams,upstream:typeof fetch):Promise<unknown>{
 const response=await upstream(TOKEN_ENDPOINT,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:body.toString(),redirect:'error',signal:AbortSignal.timeout(10000),cache:'no-store'});
 return boundedJson(response);
}
export async function exchangeGoogleCode(configValue:{clientId:string;clientSecret:string;callbackUrl:string;allowLocal?:boolean},code:string,verifier:string,upstream:typeof fetch=fetch):Promise<GoogleTokens>{
 config(configValue);if(!code||code.length>8192||!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier))throw Error('Invalid authorization response');
 const body=new URLSearchParams({client_id:configValue.clientId,client_secret:configValue.clientSecret,code,code_verifier:verifier,redirect_uri:validateCallbackUrl(configValue.callbackUrl,configValue.allowLocal),grant_type:'authorization_code'});
 const result=tokenResponse.parse(await post(body,upstream));if(!result.scope)throw Error('Google did not report an authorization scope');checkScope(result.scope);if(!result.refresh_token)throw Error('Google did not issue an offline credential');
 return {accessToken:result.access_token,refreshToken:result.refresh_token,expiresAt:Date.now()+result.expires_in*1000,scope:result.scope};
}
export async function refreshGoogleTokens(configValue:{clientId:string;clientSecret:string},current:GoogleTokens,upstream:typeof fetch=fetch):Promise<GoogleTokens>{
 config(configValue);if(!current.refreshToken||current.refreshToken.length>8192)throw Error('Invalid Gmail credential');
 const body=new URLSearchParams({client_id:configValue.clientId,client_secret:configValue.clientSecret,refresh_token:current.refreshToken,grant_type:'refresh_token'});
 const result=tokenResponse.parse(await post(body,upstream));const scope=result.scope??current.scope;checkScope(scope);
 return {accessToken:result.access_token,refreshToken:result.refresh_token??current.refreshToken,expiresAt:Date.now()+result.expires_in*1000,scope};
}
/** A false result means remote revocation is unconfirmed; access must stay blocked locally. */
export async function revokeGoogleToken(token:string,upstream:typeof fetch=fetch):Promise<boolean>{
 if(!token||token.length>8192)return false;
 try{const response=await upstream(REVOKE_ENDPOINT,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token}).toString(),redirect:'error',signal:AbortSignal.timeout(10000),cache:'no-store'});return response.ok;}catch{return false;}
}
