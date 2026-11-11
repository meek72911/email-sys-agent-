import { describe, expect, it } from 'vitest';
import { validateExtraction } from './extraction';
const message = 'Our invoice is ₹18,500. We cannot log in before Friday.';
const valid = { issues: [{category:'billing',summary:'Invoice question',sourceQuote:'invoice is ₹18,500',requestedOutcome:null}, {category:'access',summary:'Login issue',sourceQuote:'cannot log in',requestedOutcome:null}], claims:[{kind:'amount',value:'₹18,500',sourceQuote:'₹18,500'},{kind:'date',value:'Friday',sourceQuote:'Friday'}] };
describe('customer-message extraction boundary', () => {
  it('accepts separate issues and preserves claims without verifying them', () => {
    const result = validateExtraction(valid, message);
    expect(result.issues).toHaveLength(2);
    expect(result.claims[1].value).toBe('Friday');
  });
  it('captures stated outcomes and identifying statements without verifying them', () => {
    const input='I am Sam. Account A123 cannot log in. Please restore access.';
    const result=validateExtraction({issues:[{category:'access',summary:'Login',sourceQuote:'cannot log in',requestedOutcome:'restore access'}],claims:[{kind:'name',value:'Sam',sourceQuote:'I am Sam'},{kind:'identifier',value:'A123',sourceQuote:'Account A123'}]},input);
    expect(result.issues[0].requestedOutcome).toBe('restore access');expect(result.claims.map(claim=>claim.kind)).toEqual(['name','identifier']);
    expect(()=>validateExtraction({issues:[{category:'access',summary:'Login',sourceQuote:'cannot log in',requestedOutcome:'give a refund'}],claims:[]},input)).toThrow(/Requested outcome/);
    expect(()=>validateExtraction({issues:[{category:'access',summary:'Login',sourceQuote:'cannot log in'}],claims:[]},input)).toThrow();
  });
  it('rejects fabricated source quotes', () => {
    expect(() => validateExtraction({...valid, claims:[{kind:'amount',value:'₹900',sourceQuote:'₹900'}]}, message)).toThrow(/source quote/);
  });
  it('rejects a fabricated claim value even if its quote is real', () => {
    expect(() => validateExtraction({...valid, claims:[{kind:'amount',value:'₹900',sourceQuote:'invoice is ₹18,500'}]}, message)).toThrow(/Claim value/);
  });
  it('rejects amount prefixes and suffixes inside larger numbers', () => {
    expect(() => validateExtraction({...valid,claims:[{kind:'amount',value:'₹1',sourceQuote:'₹1'}]},message)).toThrow(/larger number/);
    expect(() => validateExtraction({...valid,claims:[{kind:'amount',value:'500',sourceQuote:'18,500'}]},message)).toThrow(/larger number/);
  });
  it('rejects unknown fields or categories instead of silently accepting them', () => {
    expect(() => validateExtraction({...valid, verified:true}, message)).toThrow();
    expect(() => validateExtraction({...valid, issues:[{category:'refund',summary:'x',sourceQuote:'invoice',requestedOutcome:null}]}, message)).toThrow();
  });
});
