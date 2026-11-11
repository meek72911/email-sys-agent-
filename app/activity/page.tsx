import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { activityLabel } from '@/lib/activity';
type CaseEvent={id:number;case_id:string;actor_id:string;event_type:string;created_at:string};
type KnowledgeEvent={id:number;document_id:string;actor_id:string;event_type:string;created_at:string;version:number};
type WorkspaceEvent={id:number;actor_id:string;event_type:string;source_kind:string;created_at:string};
export default async function Activity(){
 const client=await supabase();const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)redirect('/login');
 const [caseResult,knowledgeResult,workspaceResult]=await Promise.all([
  client.from('audit_events').select('id,case_id,actor_id,event_type,created_at').order('created_at',{ascending:false}).limit(100),
  client.from('knowledge_audit_events').select('id,document_id,actor_id,event_type,version,created_at').order('created_at',{ascending:false}).limit(100),
  client.from('workspace_audit_events').select('id,actor_id,event_type,source_kind,created_at').order('created_at',{ascending:false}).limit(100),
 ]);
 const events=[...((caseResult.data??[]) as CaseEvent[]).map(event=>({...event,kind:'case' as const})),...((knowledgeResult.data??[]) as KnowledgeEvent[]).map(event=>({...event,kind:'knowledge' as const})),...((workspaceResult.data??[]) as WorkspaceEvent[]).map(event=>({...event,kind:'workspace' as const}))].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,100);
 const error=caseResult.error||knowledgeResult.error||workspaceResult.error;
 return <main className="content-page"><p><Link href="/workspace">← Inbox</Link></p><h1>Activity</h1><p>Latest workspace events. A queued or started action is not a confirmed result.</p>{error&&<p role="alert">Some activity is unavailable. Check the database connection and migrations.</p>}{events.length?<ol className="activity-list">{events.map(event=><li key={event.kind+'-'+event.id}><div><strong>{activityLabel(event.event_type)}</strong><p>{event.actor_id===user.id?'You':'Workspace member'} · {event.kind==='knowledge'?`Version ${event.version} · `:event.kind==='workspace'?(event.source_kind==='gmail'?'Gmail import · ':'Manual request · '):''}<time dateTime={event.created_at}>{new Date(event.created_at).toUTCString()}</time></p></div>{event.kind==='case'?<Link href={'/workspace?case='+encodeURIComponent(event.case_id)}>Open case</Link>:event.kind==='knowledge'?<Link href={'/knowledge#knowledge-'+encodeURIComponent(event.document_id)}>Open knowledge</Link>:null}</li>)}</ol>:!error&&<p>No activity yet.</p>}</main>;
}
