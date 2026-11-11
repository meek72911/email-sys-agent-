import type { Extraction } from './extraction';
export type EvalFixture={id:string;group:string;categories:string[];expectedClaims:{source:string;status:string}[]};
export type EvalCase={id:string;group:string;expectedCategories:string[];predictedCategories:string[];expectedClaims:string[];predictedClaims:string[];issueExact:boolean;claimExact:boolean;latencyMs:number;error?:string};
const normalize=(items:string[])=>[...new Set(items)].sort();
export function scoreCase(fixture:EvalFixture,result:Extraction|null,latencyMs:number,error?:string):EvalCase{
 const expectedCategories=normalize(fixture.categories),predictedCategories=normalize(result?.issues.map(issue=>issue.category)??[]);
 const expectedClaims=normalize(fixture.expectedClaims.map(claim=>claim.source)),predictedClaims=normalize(result?.claims.filter(claim=>claim.kind==='amount'||claim.kind==='date').map(claim=>claim.value)??[]);
 const exact=(a:string[],b:string[])=>JSON.stringify(a)===JSON.stringify(b);
 return {id:fixture.id,group:fixture.group,expectedCategories,predictedCategories,expectedClaims,predictedClaims,issueExact:!!result&&exact(expectedCategories,predictedCategories),claimExact:!!result&&exact(expectedClaims,predictedClaims),latencyMs,error};
}
export function summarizeEvaluation(cases:EvalCase[]){
 const count=cases.length,exact=cases.filter(c=>c.issueExact).length,claimExact=cases.filter(c=>c.claimExact).length;
 const multi=cases.filter(c=>c.group==='multi');const success=cases.filter(c=>!c.error);
 const latencies=success.map(c=>c.latencyMs).sort((a,b)=>a-b);
 const percentile=(p:number)=>latencies.length?latencies[Math.ceil(p*latencies.length)-1]:null;
 const groups=Object.fromEntries([...new Set(cases.map(c=>c.group))].map(group=>{const entries=cases.filter(c=>c.group===group);return [group,{total:entries.length,issueExact:entries.filter(c=>c.issueExact).length,claimExact:entries.filter(c=>c.claimExact).length,errors:entries.filter(c=>c.error).length}];}));
 return {total:count,errors:count-success.length,issueCategoryExact:{correct:exact,total:count,rate:count?exact/count:null},claimSetExact:{correct:claimExact,total:count,rate:count?claimExact/count:null},multiIssueExact:{correct:multi.filter(c=>c.issueExact).length,total:multi.length,rate:multi.length?multi.filter(c=>c.issueExact).length/multi.length:null},latencyMs:{successfulCalls:latencies.length,p50:percentile(.5),p95:percentile(.95)},groups};
}
