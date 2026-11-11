/**
 * External-write recovery contract. Storage implementations must make `claim` an
 * atomic queued -> dispatching transition. A claimed action is never re-sent
 * automatically, even when reconciliation cannot determine its result.
 */
export type DispatchState='queued'|'dispatching'|'needs_reconciliation'|'succeeded'|'failed';
export type DispatchRecord={id:string;payloadHash:string;state:DispatchState};
export type ProviderResult=
 | {status:'succeeded';payloadHash:string}
 | {status:'failed';payloadHash:string}
 | {status:'unknown'};
export interface DispatchStore {
 get(id:string):Promise<DispatchRecord|null>;
 claim(id:string):Promise<DispatchRecord|null>;
 // Atomic transition: never overwrite a terminal state; return the persisted state.
 mark(id:string,state:'needs_reconciliation'|'succeeded'|'failed'):Promise<DispatchState>;
}
export interface SandboxProvider {
 send(action:DispatchRecord):Promise<ProviderResult>;
 lookup(actionId:string):Promise<ProviderResult>;
}
export async function reconcile(store:DispatchStore,provider:SandboxProvider,id:string):Promise<DispatchState>{
 const action=await store.get(id);
 if(!action)throw new Error('Action unavailable');
 if(action.state==='succeeded'||action.state==='failed')return action.state;
 if(action.state==='queued')return 'queued';
 // Persist uncertainty before contacting the provider, including after a worker crash.
 const marked=await store.mark(id,'needs_reconciliation');
 if(marked==='succeeded'||marked==='failed')return marked;
 let result:ProviderResult;
 try {result=await provider.lookup(id);} catch {return 'needs_reconciliation';}
 if(result.status==='unknown'||result.payloadHash!==action.payloadHash)return 'needs_reconciliation';
 return store.mark(id,result.status);
}
export async function dispatchOnce(store:DispatchStore,provider:SandboxProvider,id:string):Promise<DispatchState>{
 const existing=await store.get(id);
 if(!existing)throw new Error('Action unavailable');
 if(existing.state==='succeeded'||existing.state==='failed')return existing.state;
 if(existing.state!=='queued')return reconcile(store,provider,id);
 const claimed=await store.claim(id);
 if(!claimed)return reconcile(store,provider,id);
 let result:ProviderResult;
 try {result=await provider.send(claimed);} catch {
  // Timeout, crash or response loss is not proof of failure.
  return reconcile(store,provider,id);
 }
 if(result.status==='unknown'||result.payloadHash!==claimed.payloadHash)return reconcile(store,provider,id);
 return store.mark(id,result.status);
}
