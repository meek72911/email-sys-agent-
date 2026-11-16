import type { Metadata } from 'next';
import { connection } from 'next/server';
import { z } from 'zod';
import AppHeader from '@/app/ui/app-header';
import { canOperate } from '@/lib/roles';
import { isDemoEmail } from '@/lib/demo';
import { requireUser } from '@/lib/session';
import CaseList from './case-list';
import CaseDetail from './case-detail';
import { createWorkspace } from './actions';
import type { ActionRow, CaseRecord, EventRow, EvidenceRow, ExternalRow, JobRow } from './types';

export const metadata: Metadata = { title: 'Inbox' };

const CASE_FIELDS = 'id, customer, subject, message, created_at, ticket_status, draft, draft_review_state, draft_review_revision, organizations(knowledge_revision), source_kind, expires_at';

export default async function Workspace({
  searchParams,
}: {
  searchParams: Promise<{ case?: string; error?: string; evidence?: string; deleted?: string }>;
}) {
  await connection();
  const { client, user } = await requireUser();
  const demoWorkspace = isDemoEmail(user.email);

  const { data: membership, error: membershipError } = await client
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  const canWrite = !membershipError && canOperate(membership?.role);

  const params = await searchParams;
  const result = await client
    .from('cases')
    .select(CASE_FIELDS)
    .order('created_at', { ascending: false })
    .limit(50);

  let cases = (result.data ?? []) as CaseRecord[];
  let selected = cases.find(item => item.id === params.case);

  if (!selected && z.uuid().safeParse(params.case).success) {
    const extra = await client
      .from('cases')
      .select(CASE_FIELDS)
      .eq('id', params.case)
      .maybeSingle();
    if (!extra.error && extra.data) {
      selected = extra.data as CaseRecord;
      cases = [selected, ...cases.slice(0, 49)];
    }
  }
  selected = selected ?? cases[0];

  let actions: ActionRow[] = [];
  let events: EventRow[] = [];
  let jobs: JobRow[] = [];
  let external: ExternalRow[] = [];
  let detailsError = false;

  const evidenceQuery = (params.evidence ?? '').trim().slice(0, 200);
  let evidence: EvidenceRow[] = [];
  let evidenceError = false;

  if (selected && evidenceQuery) {
    const found = await client.rpc('relay_search_knowledge', { p_query: evidenceQuery });
    evidence = (found.data ?? []) as EvidenceRow[];
    evidenceError = !!found.error;
  }

  if (selected) {
    const [actionResult, eventResult, jobResult, externalResult] = await Promise.all([
      client.from('crm_actions').select('id,from_status,to_status,state,created_at').eq('case_id', selected.id).order('created_at', { ascending: false }).limit(10),
      client.from('audit_events').select('id,event_type,created_at').eq('case_id', selected.id).order('created_at', { ascending: false }).limit(20),
      client.from('action_jobs').select('id,action_id,state,created_at,finished_at,failure_code').eq('case_id', selected.id).order('created_at', { ascending: false }).limit(10),
      client.from('external_dispatches').select('id,state,sync_state,updated_at').eq('case_id', selected.id).order('created_at', { ascending: false }).limit(10),
    ]);
    actions = (actionResult.data ?? []) as ActionRow[];
    events = (eventResult.data ?? []) as EventRow[];
    jobs = (jobResult.data ?? []) as JobRow[];
    external = (externalResult.data ?? []) as ExternalRow[];
    detailsError = !!(actionResult.error || eventResult.error || jobResult.error || externalResult.error);
  }

  return (
    <div className="app-frame">
      <AppHeader current="/workspace" email={user.email} demo={demoWorkspace} />
      <main className="workspace" id="main">
        <aside className="workspace-inbox" aria-label="Inbox">
          <CaseList cases={cases} selectedId={selected?.id} canWrite={canWrite} />
        </aside>

        <section className="case-detail" id="case-detail" aria-label="Case detail">
          {demoWorkspace && (
            <p className="notice notice-demo" role="status">
              <strong>Synthetic demo workspace:</strong> changes are shared with other visitors and reset nightly. Do not enter real customer data.
            </p>
          )}
          {params.deleted === 'request' && <p className="notice" role="status">Request deleted.</p>}

          {result.error
            ? (
              <div className="state-card">
                <p className="card-index">Setup</p>
                <h2>Workspace setup required</h2>
                <p>The database schema is not available or is out of date. Apply the pending migrations.</p>
              </div>
            )
            : cases.length === 0
              ? (
                <div className="state-card state-empty">
                  <p className="card-index">Start here</p>
                  <h2>Your workspace</h2>
                  {params.deleted === '1' && <p role="status">Workspace deleted.</p>}
                  <p>Create an isolated workspace with synthetic examples.</p>
                  {params.error && (
                    <p role="alert">Workspace creation failed. Check that the migration is installed.</p>
                  )}
                  <form action={createWorkspace}>
                    <button>Create workspace</button>
                  </form>
                </div>
              )
              : selected
                ? (
                  <CaseDetail
                    caseRecord={selected}
                    actions={actions}
                    events={events}
                    jobs={jobs}
                    external={external}
                    evidence={evidence}
                    evidenceQuery={evidenceQuery}
                    evidenceError={evidenceError}
                    detailsError={detailsError}
                    canWrite={canWrite}
                    membershipError={!!membershipError}
                    role={membership?.role ?? null}
                    error={params.error}
                  />
                )
                : null}
        </section>
      </main>
    </div>
  );
}
