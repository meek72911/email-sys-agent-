import type { Metadata } from 'next';
import Link from 'next/link';
import AppHeader from '@/app/ui/app-header';
import { activityLabel } from '@/lib/activity';
import { isDemoEmail } from '@/lib/demo';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Activity' };

type CaseEvent = {
  id: number;
  case_id: string;
  actor_id: string;
  event_type: string;
  created_at: string;
};

type KnowledgeEvent = {
  id: number;
  document_id: string;
  actor_id: string;
  event_type: string;
  created_at: string;
  version: number;
};

type WorkspaceEvent = {
  id: number;
  actor_id: string;
  event_type: string;
  source_kind: string;
  created_at: string;
};

export default async function Activity() {
  const { client, user } = await requireUser();
  const [caseResult, knowledgeResult, workspaceResult] = await Promise.all([
    client.from('audit_events').select('id,case_id,actor_id,event_type,created_at').order('created_at', { ascending: false }).limit(100),
    client.from('knowledge_audit_events').select('id,document_id,actor_id,event_type,version,created_at').order('created_at', { ascending: false }).limit(100),
    client.from('workspace_audit_events').select('id,actor_id,event_type,source_kind,created_at').order('created_at', { ascending: false }).limit(100),
  ]);

  const events = [
    ...((caseResult.data ?? []) as CaseEvent[]).map(event => ({ ...event, kind: 'case' as const })),
    ...((knowledgeResult.data ?? []) as KnowledgeEvent[]).map(event => ({ ...event, kind: 'knowledge' as const })),
    ...((workspaceResult.data ?? []) as WorkspaceEvent[]).map(event => ({ ...event, kind: 'workspace' as const })),
  ]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 100);

  const deletedDocuments = new Set(
    ((knowledgeResult.data ?? []) as KnowledgeEvent[])
      .filter(event => event.event_type === 'knowledge_deleted')
      .map(event => event.document_id),
  );
  const error = caseResult.error || knowledgeResult.error || workspaceResult.error;

  return (
    <div className="app-frame">
      <AppHeader current="/activity" email={user.email} demo={isDemoEmail(user.email)} />
      <main className="content-page" id="main">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/workspace">Workspace</Link>
          <span aria-hidden="true">/</span>
          <span>Activity</span>
        </nav>

        <header className="page-head">
          <p className="page-kicker">Audit trail</p>
          <h1>Activity</h1>
          <p>Latest workspace events. A queued or started action is not a confirmed result.</p>
        </header>

        {error && (
          <p className="notice notice-error" role="alert">
            Some activity is unavailable. Check the database connection and migrations.
          </p>
        )}

        {events.length
          ? (
            <ol className="activity-list">
              {events.map(event => (
                <li key={event.kind + '-' + event.id}>
                  <div>
                    <strong>{activityLabel(event.event_type)}</strong>
                    <p>
                      {event.actor_id === user.id ? 'You' : 'Workspace member'}
                      <span aria-hidden="true"> · </span>
                      {event.kind === 'knowledge'
                        ? `Version ${event.version} · `
                        : event.kind === 'workspace'
                          ? (event.source_kind === 'gmail' ? 'Gmail import · ' : 'Manual request · ')
                          : ''}
                      <time dateTime={event.created_at}>{new Date(event.created_at).toUTCString()}</time>
                    </p>
                  </div>
                  {event.kind === 'case'
                    ? <Link href={'/workspace?case=' + encodeURIComponent(event.case_id)}>Open case</Link>
                    : event.kind === 'knowledge' && !deletedDocuments.has(event.document_id)
                      ? <Link href={'/knowledge#knowledge-' + encodeURIComponent(event.document_id)}>Open knowledge</Link>
                      : null}
                </li>
              ))}
            </ol>
          )
          : !error && <div className="state-card"><h2>No activity yet.</h2><p>Draft reviews, ticket changes and knowledge edits will appear here.</p></div>}
      </main>
    </div>
  );
}
