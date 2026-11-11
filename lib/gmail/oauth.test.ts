import { describe,expect,it,vi } from 'vitest';
import { randomBytes,createHash } from 'node:crypto';
import { seal,unseal } from './crypto';
import { newOAuthState,verifyOAuthState,buildAuthorizationUrl,validateCallbackUrl,GMAIL_READONLY_SCOPE } from './oauth';
import { exchangeGoogleCode,refreshGoogleTokens,revokeGoogleToken } from './tokens';
const user='00000000-0000-4000-8000-000000000001',org='00000000-0000-4000-8000-000000000002';
const key=Buffer.alloc(32,1).toString('base64');
describe('Gmail OAuth preparation',()=>{
 it('encrypts credentials with fresh nonces and binds them to their workspace and user',()=>{
  const context=`gmail:${org}:${user}`,value={refreshToken:'synthetic-token'};const a=seal(value,key,context),b=seal(value,key,context);
  expect(a).not.toBe(b);expect(a).not.toContain('synthetic-token');expect(unseal(a,key,context)).toEqual(value);
  expect(()=>unseal(a,key,`gmail:${org}:other`)).toThrow();expect(()=>unseal(a,randomBytes(32).toString('base64'),context)).toThrow();
  const parts=a.split('.');parts[2]=Buffer.alloc(16).toString('base64url');expect(()=>unseal(parts.join('.'),key,context)).toThrow();
 });
 it('binds PKCE state to user, organization and expiry',()=>{
  const state=newOAuthState(user,org,1000);expect(verifyOAuthState(state,state.state,user,org,2000)).toEqual(state);
  expect(()=>verifyOAuthState(state,state.state,user,org,601000)).toThrow(/expired/);
  expect(()=>verifyOAuthState(state,'x'.repeat(43),user,org,2000)).toThrow();
  expect(()=>verifyOAuthState(state,state.state,user,'00000000-0000-4000-8000-000000000003',2000)).toThrow();
  const url=new URL(buildAuthorizationUrl({clientId:'client',callbackUrl:'https://relay.example/api/connections/gmail/callback'},state));
  expect(url.origin).toBe('https://accounts.google.com');expect(url.searchParams.get('scope')).toBe(GMAIL_READONLY_SCOPE);
  expect(url.searchParams.get('code_challenge')).toBe(createHash('sha256').update(state.verifier).digest('base64url'));
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');expect(url.searchParams.has('client_secret')).toBe(false);
  expect(()=>validateCallbackUrl('http://evil.example/api/connections/gmail/callback')).toThrow();
  expect(()=>validateCallbackUrl('https://relay.example/api/connections/gmail/callback?other=1')).toThrow();
 });
 it('exchanges only at Google, enforces readonly scope, and preserves a refresh token',async()=>{
  const state=newOAuthState(user,org);const reply={access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_in:3600,scope:GMAIL_READONLY_SCOPE,token_type:'Bearer'};
  const upstream=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify(reply),{status:200}));
  const config={clientId:'client',clientSecret:'secret',callbackUrl:'https://relay.example/api/connections/gmail/callback'};
  const tokens=await exchangeGoogleCode(config,'synthetic-code',state.verifier,upstream);
  expect(tokens.refreshToken).toBe('synthetic-refresh');expect(upstream.mock.calls[0][0]).toBe('https://oauth2.googleapis.com/token');expect(upstream.mock.calls[0][1]).toMatchObject({redirect:'error'});
  const refresh=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({...reply,refresh_token:undefined,scope:undefined}),{status:200}));expect((await refreshGoogleTokens(config,tokens,refresh)).refreshToken).toBe(tokens.refreshToken);
  const broad=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({...reply,scope:GMAIL_READONLY_SCOPE+' https://www.googleapis.com/auth/gmail.modify'}),{status:200}));
  await expect(exchangeGoogleCode(config,'code',state.verifier,broad)).rejects.toThrow(/scope/);
 });
 it('does not claim remote revocation after a timeout or error',async()=>{
  const failed=vi.fn<typeof fetch>(async()=>{throw Error('offline');});expect(await revokeGoogleToken('synthetic-token',failed)).toBe(false);
  expect(await revokeGoogleToken('synthetic-token',vi.fn<typeof fetch>(async()=>new Response(null,{status:200})))).toBe(true);
 });
});
