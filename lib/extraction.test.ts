import { describe, expect, it } from 'vitest';
import { validateExtraction } from './extraction';
const message = 'Our invoice is ₹18,500. We cannot log in before Friday.';
const valid = { issues: [{category:'billing',summary:'Invoice question',sourceQuote:'invoice is ₹18,500'}, {category:'access',summary:'Login issue',sourceQuote:'cannot log in'}], claims:[{kind:'amount',value:'₹18,500',sourceQuote:'₹18,500'},{kind:'date',value:'Friday',sourceQuote:'Friday'}] };
describe('customer-message extraction boundary', () => {
  it('accepts separate issues and preserves claims without verifying them', () => {
    const result = validateExtraction(valid, message);
    expect(result.issues).toHaveLength(2);
    expect(result.claims[1].value).toBe('Friday');
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
    expect(() => validateExtraction({...valid, issues:[{category:'refund',summary:'x',sourceQuote:'invoice'}]}, message)).toThrow();
  });
});
