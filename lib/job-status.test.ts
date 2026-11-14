import { describe,expect,it } from 'vitest';
import { jobFailureMessage,mayRetryJob } from './job-status';
describe('local job diagnostics',()=>{
 it('explains changes that need a new proposal and prevents misleading retries',()=>{
  expect(jobFailureMessage('knowledge_changed')).toMatch(/new proposal/);expect(mayRetryJob('knowledge_changed')).toBe(false);expect(mayRetryJob('ticket_changed')).toBe(false);expect(mayRetryJob('external_pending')).toBe(false);
 });
 it('uses a safe generic message for historical or unknown failures',()=>{expect(jobFailureMessage('provider secret')).not.toContain('provider secret');expect(mayRetryJob(null)).toBe(true);});
});
