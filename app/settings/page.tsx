import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { deleteWorkspace } from './actions';
export default async function Settings({searchParams}:{searchParams:Promise<{error?:string}>}){
 const client=await supabase();const {data:{user},error}=await client.auth.getUser();if(error||!user)redirect('/login');
 const {data:membership,error:membershipError}=await client.from('memberships').select('org_id,role').eq('user_id',user.id).maybeSingle();
 const {error:actionError}=await searchParams;
 return <main className="content-page"><p><Link href="/workspace">← Inbox</Link></p><h1>Workspace settings</h1>{membershipError?<p role="alert">Workspace settings are unavailable.</p>:!membership?<p>No workspace exists for this account.</p>:<><p>Role: {membership.role}</p><article><h2>Delete workspace</h2><p>This removes this workspace’s cases, drafts, knowledge, actions and activity from Relay. Your sign-in account remains. This cannot be undone.</p><p>Deletion is blocked if a separate CRM dispatch exists, because its records require coordinated cleanup that is not implemented yet.</p>{membership.role==='owner'?<form action={deleteWorkspace}><input type="hidden" name="orgId" value={membership.org_id}/><label htmlFor="confirmation">Type DELETE to confirm</label><input id="confirmation" name="confirmation" required autoComplete="off" pattern="DELETE"/><button>Delete workspace</button></form>:<p>Only a workspace owner can delete it.</p>}{actionError&&<p role="alert">{actionError==='confirmation'?'Type DELETE to confirm.':'Deletion failed. Check owner access and whether external sandbox records require cleanup.'}</p>}</article></>}</main>;
}
