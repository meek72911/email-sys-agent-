import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('@/lib/supabase',()=>({supabase:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:vi.fn(()=>({}))}));
vi.mock('@/lib/gmail/tokens',()=>({exchangeGoogleCode:vi.fn(),revokeGoogleToken:vi.fn()}));
vi.mock('@/lib/gmail/vault',()=>({createCredentialVault:vi.fn()}));
import { supabase } from '@/lib/supabase';
import { exchangeGoogleCode,revokeGoogleToken } from '@/lib/gmail/tokens';
import { createCredentialVault } from '@/lib/gmail/vault';
import { POST as start } from './start/route';
import { GET as callback } from './callback/route';
import { POST as disconnect } from './disconnect/route';
const userId='00000000-0000-4000-8000-000000000001',orgId='00000000-0000-4000-8000-000000000002',attemptId='00000000-0000-4000-8000-000000000003';
const origin='https://relay.example',callbackUrl=origin+'/api/connections/gmail/callback';
const token={accessToken:'fake-access',refreshToken:'fake-refresh',expiresAt:Date.now()+3600000,scope:'https://www.googleapis.com/auth/gmail.readonly'};
function client(role='owner',consumeError=false){return {auth:{getUser:async()=>({data:{user:{id:userId}},error:null})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{org_id:orgId,role},error:null})})})}),rpc:vi.fn(async(name:string)=>({data:attemptId,error:name==='relay_consume_gmail_oauth'&&consumeError?{message:'replay'}:null}))};}
function configure(){vi.stubEnv('RELAY_ENABLE_GMAIL','true');vi.stubEnv('GMAIL_ACCESS_REVIEWED','true');vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID','fake-client');vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET','fake-secret');vi.stubEnv('GOOGLE_OAUTH_CALLBACK_URL',callbackUrl);vi.stubEnv('GMAIL_CREDENTIAL_ENCRYPTION_KEY',Buffer.alloc(32,9).toString('base64'));vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://example.invalid');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','fake-service');}
function startRequest(givenOrigin=origin){return new Request(origin+'/api/connections/gmail/start',{method:'POST',headers:{origin:givenOrigin}});}
describe('Gmail OAuth route gates',()=>{
 beforeEach(()=>{vi.resetAllMocks();configure();});afterEach(()=>vi.unstubAllEnvs());
 it('is disabled without explicit enablement and review, and rejects cross-site requests',async()=>{
  vi.stubEnv('GMAIL_ACCESS_REVIEWED','false');expect((await start(startRequest())).status).toBe(503);expect(supabase).not.toHaveBeenCalled();
  vi.stubEnv('GMAIL_ACCESS_REVIEWED','true');expect((await start(startRequest('https://evil.example'))).status).toBe(403);expect(supabase).not.toHaveBeenCalled();
 });
 it('requires an owner before beginning authorization',async()=>{
  vi.mocked(supabase).mockResolvedValue(client('viewer') as never);expect((await start(startRequest())).status).toBe(403);
 });
 it('uses a one-time, session-bound state and never puts tokens into the redirect',async()=>{
  const c=client();vi.mocked(supabase).mockResolvedValue(c as never);const store=vi.fn().mockResolvedValue(undefined);
  vi.mocked(createCredentialVault).mockReturnValue({storeAfterOAuth:store} as never);vi.mocked(exchangeGoogleCode).mockResolvedValue(token);
  const started=await start(startRequest());expect(started.status).toBe(303);const location=started.headers.get('location')!;const state=new URL(location).searchParams.get('state');expect(state).toBeTruthy();
  const cookie=started.headers.get('set-cookie')!.split(';')[0];expect(started.headers.get('set-cookie')).toContain('HttpOnly');expect(started.headers.get('set-cookie')).toContain('Secure');expect(location).not.toContain('fake-secret');
  const mismatch=await callback(new NextRequest(callbackUrl+'?code=fake-code&state='+ 'A'.repeat(43),{headers:{cookie}}));expect(mismatch.headers.get('location')).toContain('gmail=failed');expect(exchangeGoogleCode).not.toHaveBeenCalled();
  const request=new NextRequest(callbackUrl+'?code=fake-code&state='+state,{headers:{cookie}});const finished=await callback(request);
  expect(finished.status).toBe(303);expect(finished.headers.get('location')).toBe(origin+'/connections?gmail=connected');expect(finished.headers.get('location')).not.toContain('fake-access');expect(store).toHaveBeenCalledWith(attemptId,token);expect(finished.headers.get('set-cookie')).toContain('Max-Age=0');
  vi.mocked(supabase).mockResolvedValue(client('owner',true) as never);vi.mocked(exchangeGoogleCode).mockClear();const replay=await callback(request);expect(replay.headers.get('location')).toContain('gmail=failed');expect(exchangeGoogleCode).not.toHaveBeenCalled();
 });
 it('attempts revocation when token exchange succeeded but vault storage failed',async()=>{
  vi.mocked(supabase).mockResolvedValue(client() as never);vi.mocked(exchangeGoogleCode).mockResolvedValue(token);vi.mocked(createCredentialVault).mockReturnValue({storeAfterOAuth:vi.fn().mockRejectedValue(Error('offline'))} as never);vi.mocked(revokeGoogleToken).mockResolvedValue(false);
  const started=await start(startRequest());const state=new URL(started.headers.get('location')!).searchParams.get('state');const cookie=started.headers.get('set-cookie')!.split(';')[0];
  const result=await callback(new NextRequest(callbackUrl+'?code=fake-code&state='+state,{headers:{cookie}}));expect(result.headers.get('location')).toContain('gmail=failed');expect(revokeGoogleToken).toHaveBeenCalledWith('fake-refresh');
 });
 it('reports remote revocation uncertainty and permits disconnect when the feature flag is off',async()=>{
  vi.stubEnv('RELAY_ENABLE_GMAIL','false');vi.mocked(supabase).mockResolvedValue(client() as never);vi.mocked(createCredentialVault).mockReturnValue({disconnect:vi.fn().mockResolvedValue('revocation_pending')} as never);
  const result=await disconnect(new Request(origin+'/api/connections/gmail/disconnect',{method:'POST',headers:{origin}}));expect(result.status).toBe(303);expect(result.headers.get('location')).toContain('gmail=revocation_pending');
 });
});
