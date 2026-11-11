import { describe,expect,it } from 'vitest';
import { workflowPayloadWithinLimit } from './request-limit';
describe('worker request size boundary',()=>{
 it('preserves the original body for signature verification and parsing',async()=>{
  const request=new Request('https://example.invalid/api/inngest',{method:'POST',headers:{'content-type':'application/json'},body:'{"data":"synthetic"}'});
  expect(await workflowPayloadWithinLimit(request,64)).toBe(true);expect(await request.text()).toBe('{"data":"synthetic"}');
 });
 it('rejects oversized declared or streamed bodies and malformed content lengths',async()=>{
  expect(await workflowPayloadWithinLimit(new Request('https://example.invalid',{method:'POST',headers:{'content-length':'100'},body:'x'}),10)).toBe(false);
  expect(await workflowPayloadWithinLimit(new Request('https://example.invalid',{method:'POST',headers:{'content-length':'bad'},body:'x'}),10)).toBe(false);
  expect(await workflowPayloadWithinLimit(new Request('https://example.invalid',{method:'POST',body:'x'.repeat(11)}),10)).toBe(false);
 });
});
