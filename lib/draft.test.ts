import { describe, expect, it } from 'vitest';
import { validateDraft } from './draft';
const allowed='00000000-0000-4000-8000-000000000001';
const unknown='00000000-0000-4000-8000-000000000002';
describe('draft citations',()=>{
 it('accepts sentences with known source ids',()=>expect(validateDraft({sentences:[{text:'We will review the invoice.',sourceIds:[allowed]}]},[allowed]).sentences).toHaveLength(1));
 it('rejects invented or absent citations',()=>{
  expect(()=>validateDraft({sentences:[{text:'Refund approved.',sourceIds:[unknown]}]},[allowed])).toThrow(/unavailable source/);
  expect(()=>validateDraft({sentences:[{text:'Refund approved.',sourceIds:[]}]},[allowed])).toThrow();
 });
});
