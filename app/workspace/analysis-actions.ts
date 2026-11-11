"use server";
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { extractCustomerMessage } from '@/lib/openai-extraction';
import { generateGroundedDraft } from '@/lib/openai-draft';
import type { AnalysisState, Evidence } from '@/lib/analysis-types';
import { knowledgeQueries } from '@/lib/knowledge-queries';
export async function analyzeCase(_previous:AnalysisState,form:FormData):Promise<AnalysisState>{
 const parsed=z.uuid().safeParse(form.get('caseId'));
 if(!parsed.success)return {error:'Invalid case.'};
 if(!process.env.OPENAI_API_KEY||!process.env.OPENAI_MODEL)return {error:'OpenAI is not configured. No analysis was run.'};
 const client=await supabase();
 const {data:{user},error:authError}=await client.auth.getUser();
 if(authError||!user)return {error:'Sign in to analyze a case.'};
 const {data:record,error:caseError}=await client.from('cases').select('id,message,org_id').eq('id',parsed.data).maybeSingle();
 if(caseError||!record)return {error:'Case is unavailable.'};
 const getRevision=async()=>{const result=await client.from('organizations').select('knowledge_revision').eq('id',record.org_id).maybeSingle();if(result.error || typeof result.data?.knowledge_revision!=='number')throw Error('Knowledge revision unavailable');return result.data.knowledge_revision;};
 let initialRevision:number;try{initialRevision=await getRevision();}catch{return {error:'Knowledge is unavailable. No analysis was run.'};}
 // Reserve before making a paid call. A failure still consumes the reservation.
 const {data:remaining,error:quotaError}=await client.rpc('relay_reserve_analysis',{p_case:record.id});
 if(quotaError || typeof remaining!=='number')return {error:'Analysis is unavailable, your daily limit is reached, or your role does not permit it.'};
 try {
  const extraction=await extractCustomerMessage(record.message);
  const issues=await Promise.all(extraction.issues.map(async issue=>{
   const query=knowledgeQueries[issue.category];
   if(!query)return {...issue,evidence:[],evidenceUnavailable:false};
   const result=await client.rpc('relay_search_knowledge',{p_query:query});
   return {...issue,evidence:(result.data??[]).slice(0,3) as Evidence[],evidenceUnavailable:!!result.error};
  }));
  // Avoid generating a draft from knowledge replaced during extraction or retrieval.
  if(await getRevision()!==initialRevision)return {error:'Knowledge changed during analysis. Run analysis again to review current evidence.',remaining};
  // Missing evidence or a retrieval failure requires investigation, not a fabricated answer.
  const allEvidence=[...new Map(issues.flatMap(issue=>issue.evidence).map(item=>[item.id,item])).values()];
  let draft:AnalysisState['draft']; let draftError:string|undefined;
  if(!issues.length||issues.some(issue=>issue.evidenceUnavailable||!issue.evidence.length)) draftError='Draft withheld because at least one issue lacks evidence. Human investigation is required.';
  else { try {draft=await generateGroundedDraft(record.message,allEvidence);} catch {draftError='Draft generation failed or cited an unavailable source. Review the case manually.';} }
  // Check again after the provider returns; do not display a stale generated draft.
  if(await getRevision()!==initialRevision)return {error:'Knowledge changed during analysis. Run analysis again to review current evidence.',remaining};
  return {model:process.env.OPENAI_MODEL,remaining,issues,claims:extraction.claims,draft,draftError};
 }catch{return {error:'Analysis failed or returned invalid data. The original message is unchanged. This attempt counted toward the daily limit.',remaining};}
}
