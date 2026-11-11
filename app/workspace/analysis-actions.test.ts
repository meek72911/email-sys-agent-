import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
vi.mock('@/lib/supabase',()=>({supabase:vi.fn()}));
vi.mock('@/lib/openai-extraction',()=>({extractCustomerMessage:vi.fn()}));
vi.mock('@/lib/openai-draft',()=>({generateGroundedDraft:vi.fn()}));
import { supabase } from '@/lib/supabase';
import { extractCustomerMessage } from '@/lib/openai-extraction';
import { generateGroundedDraft } from '@/lib/openai-draft';
import { analyzeCase } from './analysis-actions';
const caseId='00000000-0000-4000-8000-000000000001';
const form=()=>{const f=new FormData();f.set('caseId',caseId);return f;};
describe('live analysis gate',()=>{
 const oldKey=process.env.OPENAI_API_KEY,oldModel=process.env.OPENAI_MODEL;
 beforeEach(()=>{vi.resetAllMocks();process.env.OPENAI_API_KEY='test-only';process.env.OPENAI_MODEL='test-model';});
 afterEach(()=>{if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;if(oldModel===undefined)delete process.env.OPENAI_MODEL;else process.env.OPENAI_MODEL=oldModel;});
 const client=(quotaError:boolean,revisions:number[]=[1,1,1])=>({auth:{getUser:async()=>({data:{user:{id:'u'}},error:null})},from:(table:string)=>({select:()=>({eq:()=>({maybeSingle:async()=>table==='cases'?{data:{id:caseId,org_id:'org',message:'Invoice ₹10'},error:null}:{data:{knowledge_revision:revisions.shift()},error:null}})})}),rpc:vi.fn(async(name:string)=>name==='relay_reserve_analysis'?{data:quotaError?null:9,error:quotaError?{message:'limit'}:null}:{data:[{id:'doc',title:'Policy',section:'s',content:'Check',version:1}],error:null})});
 it('never calls a model without configuration or an available quota',async()=>{
  delete process.env.OPENAI_API_KEY;expect((await analyzeCase({},form())).error).toMatch(/not configured/);expect(extractCustomerMessage).not.toHaveBeenCalled();
  process.env.OPENAI_API_KEY='test-only';vi.mocked(supabase).mockResolvedValue(client(true) as never);expect((await analyzeCase({},form())).error).toMatch(/limit/);expect(extractCustomerMessage).not.toHaveBeenCalled();
 });
 it('uses the authorized stored message and retrieves evidence in the user session',async()=>{
  const c=client(false);vi.mocked(supabase).mockResolvedValue(c as never);
  vi.mocked(extractCustomerMessage).mockResolvedValue({issues:[{category:'billing',summary:'Invoice',sourceQuote:'Invoice'}],claims:[{kind:'amount',value:'₹10',sourceQuote:'₹10'}]});
  vi.mocked(generateGroundedDraft).mockResolvedValue({sentences:[{text:'We will review.',sourceIds:['00000000-0000-4000-8000-000000000001']}]});
  const result=await analyzeCase({},form());expect(result.draft?.sentences[0].text).toBe('We will review.');expect(extractCustomerMessage).toHaveBeenCalledWith('Invoice ₹10');expect(result.issues?.[0].evidence[0].title).toBe('Policy');expect(result.remaining).toBe(9);
 });
 it('withholds results when knowledge changes during analysis',async()=>{
  vi.mocked(supabase).mockResolvedValue(client(false,[1,2]) as never);
  vi.mocked(extractCustomerMessage).mockResolvedValue({issues:[{category:'billing',summary:'Invoice',sourceQuote:'Invoice'}],claims:[]});
  const result=await analyzeCase({},form());expect(result.error).toMatch(/Knowledge changed/);expect(result.issues).toBeUndefined();expect(generateGroundedDraft).not.toHaveBeenCalled();
 });
 it('withholds generated text if knowledge changes during draft generation',async()=>{
  vi.mocked(supabase).mockResolvedValue(client(false,[1,1,2]) as never);
  vi.mocked(extractCustomerMessage).mockResolvedValue({issues:[{category:'billing',summary:'Invoice',sourceQuote:'Invoice'}],claims:[]});
  vi.mocked(generateGroundedDraft).mockResolvedValue({sentences:[{text:'Draft',sourceIds:[caseId]}]});
  const result=await analyzeCase({},form());expect(result.error).toMatch(/Knowledge changed/);expect(result.draft).toBeUndefined();
 });
 it('does not consume quota or call a provider if the initial revision is unavailable',async()=>{
  const c=client(false,[]);vi.mocked(supabase).mockResolvedValue(c as never);expect((await analyzeCase({},form())).error).toMatch(/No analysis was run/);expect(c.rpc).not.toHaveBeenCalled();expect(extractCustomerMessage).not.toHaveBeenCalled();
 });
 it('reports a provider failure without a fabricated result',async()=>{
  vi.mocked(supabase).mockResolvedValue(client(false) as never);vi.mocked(extractCustomerMessage).mockRejectedValue(new Error('timeout'));
  const result=await analyzeCase({},form());expect(result.error).toMatch(/failed/);expect(result.issues).toBeUndefined();
 });
});
