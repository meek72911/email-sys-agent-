import { describe, expect, it } from 'vitest';
import { scoreCase,summarizeEvaluation } from './evaluation';
const fixture={id:'1',group:'multi',categories:['billing','access'],expectedClaims:[{source:'₹10',status:'unverified'}]};
const extraction={issues:[{category:'billing' as const,summary:'billing',sourceQuote:'invoice'},{category:'access' as const,summary:'access',sourceQuote:'login'}],claims:[{kind:'amount' as const,value:'₹10',sourceQuote:'₹10'}]};
describe('synthetic evaluation metrics',()=>{
 it('scores categories without order sensitivity and counts exact claims',()=>{const result=scoreCase(fixture,extraction,120);expect(result.issueExact).toBe(true);expect(result.claimExact).toBe(true);});
 it('counts provider failures as non-matches rather than silently excluding them',()=>{const summary=summarizeEvaluation([scoreCase(fixture,extraction,100),scoreCase({...fixture,id:'2'},null,200,'provider_or_validation_error')]);expect(summary.errors).toBe(1);expect(summary.issueCategoryExact).toEqual({correct:1,total:2,rate:.5});expect(summary.latencyMs.p95).toBe(100);});
 it('identifies missing or invented categories and claims',()=>{const result=scoreCase(fixture,{issues:[extraction.issues[0]],claims:[]},10);expect(result.issueExact).toBe(false);expect(result.claimExact).toBe(false);});
});
