import { beforeEach,afterEach,describe,expect,it,vi } from 'vitest';
vi.mock('@/lib/supabase',()=>({supabase:vi.fn()}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('next/navigation',()=>({redirect:(path:string)=>{throw Error('redirect:'+path);}}));
vi.mock('@/lib/workflows/config',()=>({durableJobsEnabled:vi.fn()}));
vi.mock('@/lib/workflows/client',()=>({inngest:{send:vi.fn()}}));
import { supabase } from '@/lib/supabase';
import { durableJobsEnabled } from '@/lib/workflows/config';
import { inngest } from '@/lib/workflows/client';
import { retryExecution } from './actions';
const caseId='00000000-0000-4000-8000-000000000001',oldJob='00000000-0000-4000-8000-000000000002',newJob='00000000-0000-4000-8000-000000000003';
function form(){const f=new FormData();f.set('caseId',caseId);f.set('jobId',oldJob);return f;}
function client(error:unknown=null){return {auth:{getUser:async()=>({data:{user:{id:'u'}}})},rpc:vi.fn(async()=>({data:error?null:newJob,error}))};}
describe('explicit local job retry',()=>{
 beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic');vi.mocked(durableJobsEnabled).mockReturnValue(true);});
 afterEach(()=>vi.unstubAllEnvs());
 it('does not request a retry when the worker is disabled',async()=>{vi.mocked(durableJobsEnabled).mockReturnValue(false);await expect(retryExecution(form())).rejects.toThrow('Background%20execution%20is%20not%20configured');expect(supabase).not.toHaveBeenCalled();expect(inngest.send).not.toHaveBeenCalled();});
 it('dispatches the fresh job ID returned by the database',async()=>{const c=client();vi.mocked(supabase).mockResolvedValue(c as never);await expect(retryExecution(form())).rejects.toThrow('/workspace?case=');expect(c.rpc).toHaveBeenCalledWith('relay_retry_action_job',{p_job:oldJob});expect(inngest.send).toHaveBeenCalledWith({id:newJob,name:'relay/sandbox.action.queued',data:{jobId:newJob}});});
 it('does not dispatch if the database rejects retry',async()=>{vi.mocked(supabase).mockResolvedValue(client({message:'denied'}) as never);await expect(retryExecution(form())).rejects.toThrow('Retry%20is%20unavailable');expect(inngest.send).not.toHaveBeenCalled();});
});
