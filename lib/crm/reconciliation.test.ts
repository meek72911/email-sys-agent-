import { describe, expect, it, vi } from 'vitest';
import { dispatchOnce, type DispatchRecord, type DispatchStore, type ProviderResult, type SandboxProvider } from './reconciliation';
function setup(send:()=>Promise<ProviderResult>,lookup:()=>Promise<ProviderResult>){
 let action:DispatchRecord={id:'a',payloadHash:'hash',state:'queued'};
 const store:DispatchStore={get:async()=>({...action}),claim:async()=>{if(action.state!=='queued')return null;action={...action,state:'dispatching'};return {...action};},mark:async(_id,state)=>{if(action.state!=='succeeded'&&action.state!=='failed')action={...action,state};return action.state;}};
 const provider:SandboxProvider={send:vi.fn(send),lookup:vi.fn(lookup)};
 return {store,provider,get:()=>action};
}
describe('external sandbox reconciliation',()=>{
 it('checks the provider after a lost response and does not repeat the write',async()=>{
  const t=setup(async()=>{throw new Error('response lost');},async()=>({status:'succeeded',payloadHash:'hash'}));
  expect(await dispatchOnce(t.store,t.provider,'a')).toBe('succeeded');
  expect(await dispatchOnce(t.store,t.provider,'a')).toBe('succeeded');
  expect(t.provider.send).toHaveBeenCalledTimes(1);
 });
 it('keeps uncertain results unknown across retries without another write',async()=>{
  const t=setup(async()=>({status:'unknown'}),async()=>({status:'unknown'}));
  expect(await dispatchOnce(t.store,t.provider,'a')).toBe('needs_reconciliation');
  expect(await dispatchOnce(t.store,t.provider,'a')).toBe('needs_reconciliation');
  expect(t.provider.send).toHaveBeenCalledTimes(1);
 });
 it('does not report success when the provider result belongs to a different payload',async()=>{
  const t=setup(async()=>({status:'succeeded',payloadHash:'other'}),async()=>({status:'succeeded',payloadHash:'other'}));
  expect(await dispatchOnce(t.store,t.provider,'a')).toBe('needs_reconciliation');
 });
 it('reconciles after a crash while dispatching without sending again',async()=>{
  const t=setup(async()=>({status:'succeeded',payloadHash:'hash'}),async()=>({status:'unknown'}));
  await t.store.claim('a');expect(await dispatchOnce(t.store,t.provider,'a')).toBe('needs_reconciliation');
  expect(t.provider.send).not.toHaveBeenCalled();
 });
 it('does not overwrite a terminal outcome during concurrent reconciliation',async()=>{
  const t=setup(async()=>({status:'unknown'}),async()=>({status:'unknown'}));
  await t.store.claim('a');
  const get=t.store.get;let first=true;
  t.store.get=async id=>{const snapshot=await get(id);if(first){first=false;await t.store.mark(id,'succeeded');}return snapshot;};
  expect(await dispatchOnce(t.store,t.provider,'a')).toBe('succeeded');
  expect(t.provider.lookup).not.toHaveBeenCalled();
 });
 it('keeps an unavailable provider response uncertain',async()=>{
  const t=setup(async()=>{throw Error('timeout');},async()=>{throw Error('offline');});
  expect(await dispatchOnce(t.store,t.provider,'a')).toBe('needs_reconciliation');expect(t.get().state).toBe('needs_reconciliation');
 });
});
