import { beforeEach,describe,expect,it,vi } from 'vitest';
vi.mock('@/lib/supabase',()=>({supabase:vi.fn()}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('next/navigation',()=>({redirect:(path:string)=>{throw new Error('redirect:'+path);}}));
import { supabase } from '@/lib/supabase';
import { createManualCase } from './actions';
const id='00000000-0000-4000-8000-000000000001';
function form(customer='A',subject='Subject',message='Message'){const value=new FormData();value.set('customer',customer);value.set('subject',subject);value.set('message',message);return value;}
function client(error:unknown=null){return {auth:{getUser:async()=>({data:{user:{id:'u'}},error:null})},rpc:vi.fn(async()=>({data:error?null:id,error}))};}
describe('manual intake action',()=>{
 beforeEach(()=>vi.resetAllMocks());
 it('rejects blank and oversized inputs before accessing the database',async()=>{expect((await createManualCase({},form(' ','Subject','Message'))).error).toBeTruthy();expect((await createManualCase({},form('A','Subject','x'.repeat(10001)))).error).toBeTruthy();expect(supabase).not.toHaveBeenCalled();});
 it('saves the validated message through the authorized database RPC',async()=>{const c=client();vi.mocked(supabase).mockResolvedValue(c as never);await expect(createManualCase({},form('  Alice  ','  Login  ','  Help  '))).rejects.toThrow('redirect:/workspace?case='+id);expect(c.rpc).toHaveBeenCalledWith('relay_create_manual_case',{p_customer:'Alice',p_subject:'Login',p_message:'Help'});});
 it('returns a safe failure when the database denies creation',async()=>{vi.mocked(supabase).mockResolvedValue(client({message:'internal data'}) as never);const result=await createManualCase({},form());expect(result.error).toMatch(/Could not add/);expect(result.error).not.toContain('internal data');});
});
