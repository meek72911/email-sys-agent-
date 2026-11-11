import { describe,expect,it } from 'vitest';
import { durableJobsEnabled } from './config';
const enabled={RELAY_ENABLE_DURABLE_JOBS:'true',INNGEST_EVENT_KEY:'event',INNGEST_SIGNING_KEY:'signing'};
describe('durable worker configuration',()=>{
 it('is disabled by default and requires both keys',()=>{expect(durableJobsEnabled({})).toBe(false);expect(durableJobsEnabled({...enabled,INNGEST_SIGNING_KEY:''})).toBe(false);});
 it('rejects any development endpoint configuration in production',()=>{expect(durableJobsEnabled({...enabled,NODE_ENV:'production',INNGEST_DEV:'1'})).toBe(false);expect(durableJobsEnabled({...enabled,NODE_ENV:'production',INNGEST_DEV:'http://127.0.0.1:8288'})).toBe(false);expect(durableJobsEnabled({...enabled,NODE_ENV:'production',INNGEST_DEVSERVER_URL:'http://example.invalid'})).toBe(false);});
 it('allows explicitly configured cloud mode',()=>expect(durableJobsEnabled({...enabled,NODE_ENV:'production'})).toBe(true));
});
