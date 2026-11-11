import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { activityLabel } from '@/lib/activity';
type CaseEvent={id:number;case_id:string;actor_id:string;event_type:string;created_at:string};
type KnowledgeEvent={id:number;document_id:string;actor_id:string;event_type:string;created_at:string;version:number};
export default async function Activity(){
 const client=await supabase();const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)redirect('/login');
 const [caseResult,knowledgeResult]=await Promise.all([
  client.from('audit_events').select('id,case_id,actor_id,event_type,created_at').order('created_at',{ascending:false}).limit(100),
  client.from('knowledge_audit_events').select('id,document_id,actor_id,event_type,version,created_at').order('created_at',{ascending:false}).limit(100),
 ]);
 const events=[...((caseResult.data??[]) as CaseEvent[]).map(event=>({...event,kind:'case' as const})),...((knowledgeResult.data??[]) as KnowledgeEvent[]).map(event=>({...event,kind:'knowledge' as const}))].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,100);
 return <main className="content-page"><p><Link href="/workspace">← Inbox</Link></p><h1>Activity</h1><p>Latest workspace events. A queued or started action is not a confirmed result.</p>{(caseResult.error||knowledgeResult.error)&&<p role="alert">Some activity is unavailable. Check the database connection and migrations.</p>}{events.length?<ol className="activity-list">{events.map(event=><li key={event.kind+'-'+event.id}><div><strong>{activityLabel(event.event_type)}</strong><p>{event.actor_id===user.id?'You':'Workspace member'} · {event.kind==='knowledge'?`Version ${event.version} · `:''}<time dateTime={event.created_at}>{new Date(event.created_at).toUTCString()}</time></p></div><Link href={event.kind==='case'?'/workspace?case='+encodeURIComponent(event.case_id):'/knowledge#knowledge-'+encodeURIComponent(event.document_id)}>{event.kind==='case'?'Open case':'Open knowledge'}</Link></li>)}</ol>:!caseResult.error&&!knowledgeResult.error&&<p>No activity yet.</p>}</main>;
}
