import { beforeEach,describe,expect,it,vi } from 'vitest';
vi.mock('next/navigation',()=>({redirect:(path:string)=>{throw Error('redirect:'+path);}}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabase:vi.fn()}));
import { supabase } from '@/lib/supabase';
import { deleteKnowledge } from './actions';
const id='00000000-0000-4000-8000-000000000001';
function form(value:string){const f=new FormData();f.set('documentId',id);f.set('confirmation',value);return f;}
describe('knowledge deletion action',()=>{
 beforeEach(()=>vi.resetAllMocks());
 it('requires typed confirmation before accessing data',async()=>{await expect(deleteKnowledge(form('delete'))).rejects.toThrow('Type%20DELETE');expect(supabase).not.toHaveBeenCalled();});
 it('requires authentication and delegates authorization to the database',async()=>{
  const rpc=vi.fn().mockResolvedValue({error:null});vi.mocked(supabase).mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:'u'}},error:null})},rpc} as never);
  await expect(deleteKnowledge(form('DELETE'))).rejects.toThrow('/knowledge?deleted=1');expect(rpc).toHaveBeenCalledWith('relay_delete_knowledge',{p_document:id});
 });
 it('does not claim success on database failure',async()=>{
  const rpc=vi.fn().mockResolvedValue({error:{message:'internal'}});vi.mocked(supabase).mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:'u'}},error:null})},rpc} as never);
  await expect(deleteKnowledge(form('DELETE'))).rejects.toThrow('Could%20not%20delete');
 });
});
