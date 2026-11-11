import { describe,expect,it,vi } from 'vitest';
import { createCredentialVault } from './vault';
import { seal } from './crypto';
import { GMAIL_READONLY_SCOPE } from './oauth';
const userId='00000000-0000-4000-8000-000000000001',orgId='00000000-0000-4000-8000-000000000002',attemptId='00000000-0000-4000-8000-000000000003';
const key=Buffer.alloc(32,7).toString('base64');const config={key,userId,orgId,clientId:'client',clientSecret:'secret'};
const tokens={accessToken:'access-secret',refreshToken:'refresh-secret',expiresAt:Date.now()+3600000,scope:GMAIL_READONLY_SCOPE};
const ciphertext=seal(tokens,key,`gmail:${orgId}:${userId}`);
describe('encrypted Gmail credential lifecycle',()=>{
 it('stores ciphertext rather than plaintext tokens',async()=>{
  const rpc=vi.fn().mockResolvedValue({data:null,error:null});const vault=createCredentialVault({rpc} as never,{rpc} as never,config);
  await vault.storeAfterOAuth(attemptId,tokens);const args=rpc.mock.calls[0][1];expect(args.p_ciphertext).not.toContain(tokens.refreshToken);expect(args.p_ciphertext).not.toContain(tokens.accessToken);
 });
 it('refuses to use a credential once local revocation has started',async()=>{
  const rpc=vi.fn().mockResolvedValue({data:{ciphertext,status:'revocation_pending',version:2},error:null});const vault=createCredentialVault({rpc} as never,{rpc} as never,config);
  await expect(vault.getActive()).rejects.toThrow(/not active/);
 });
 it('keeps revocation pending if Google cannot be reached',async()=>{
  const userRpc=vi.fn().mockResolvedValue({data:{ciphertext,status:'revocation_pending',version:2},error:null});const adminRpc=vi.fn();const vault=createCredentialVault({rpc:userRpc} as never,{rpc:adminRpc} as never,config);
  expect(await vault.disconnect(vi.fn<typeof fetch>(async()=>{throw Error('offline');}))).toBe('revocation_pending');expect(adminRpc).not.toHaveBeenCalled();
 });
 it('does not return a refreshed token if the stored credential changed concurrently',async()=>{
  const rpc=vi.fn(async(name:string)=>name==='relay_get_gmail_credential'?{data:{ciphertext,status:'active',version:1},error:null}:{data:false,error:null});
  const vault=createCredentialVault({rpc} as never,{} as never,config);
  const provider=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({access_token:'new-access',expires_in:3600,scope:GMAIL_READONLY_SCOPE,token_type:'Bearer'}),{status:200}));
  await expect(vault.refresh(provider)).rejects.toThrow(/changed during refresh/);
 });
});
