import { beforeEach,describe,expect,it,vi } from 'vitest';
vi.mock('next/navigation',()=>({redirect:(path:string)=>{throw Error('redirect:'+path);}}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabase:vi.fn()}));
import { supabase } from '@/lib/supabase';
import { deleteWorkspace } from './actions';
const id='00000000-0000-4000-8000-000000000001';
function form(value:string){const f=new FormData();f.set('orgId',id);f.set('confirmation',value);return f;}
describe('workspace deletion action',()=>{
 beforeEach(()=>vi.resetAllMocks());
 it('requires explicit typed confirmation before accessing the database',async()=>{
  await expect(deleteWorkspace(form('delete'))).rejects.toThrow('/settings?error=confirmation');expect(supabase).not.toHaveBeenCalled();
 });
 it('requires sign-in before calling the deletion function',async()=>{
  const rpc=vi.fn();vi.mocked(supabase).mockResolvedValue({auth:{getUser:async()=>({data:{user:null},error:null})},rpc} as never);
  await expect(deleteWorkspace(form('DELETE'))).rejects.toThrow('/login');expect(rpc).not.toHaveBeenCalled();
 });
 it('reports a failed deletion without claiming success',async()=>{
  const rpc=vi.fn().mockResolvedValue({error:{message:'external records'}});vi.mocked(supabase).mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:'u'}},error:null})},rpc} as never);
  await expect(deleteWorkspace(form('DELETE'))).rejects.toThrow('/settings?error=deletion');
 });
});
