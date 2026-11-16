import Analysis from './analysis';
import CopyDraft from './copy-draft';
import SandboxPanel from './sandbox-panel';
import { approveDraft, deleteRequest, propose, rejectDraft, saveDraft } from './actions';
import type { ActionRow, CaseRecord, EventRow, EvidenceRow, ExternalRow, JobRow } from './types';

function sourceLabel(sourceKind: string) {
  if (sourceKind === 'gmail') return 'Gmail import';
  if (sourceKind === 'manual') return 'Manual request';
  return 'Synthetic request';
}

function sourceDetailLabel(sourceKind: string) {
  if (sourceKind === 'gmail') return 'Gmail import';
  if (sourceKind === 'manual') return 'Manual intake';
  return 'Synthetic fixture';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export default function CaseDetail({
  caseRecord: selected,
  actions,
  events,
  jobs,
  external,
  evidence,
  evidenceQuery,
  evidenceError,
  detailsError,
  canWrite,
  membershipError,
  role,
  error,
}: {
  caseRecord: CaseRecord;
  actions: ActionRow[];
  events: EventRow[];
  jobs: JobRow[];
  external: ExternalRow[];
  evidence: EvidenceRow[];
  evidenceQuery: string;
  evidenceError: boolean;
  detailsError: boolean;
  canWrite: boolean;
  membershipError: boolean;
  role: string | null;
  error?: string;
}) {
  const organization = Array.isArray(selected.organizations) ? selected.organizations[0] : selected.organizations;
  const knowledgeRevision = typeof organization?.knowledge_revision === 'number' ? organization.knowledge_revision : null;
  const reviewStale = selected.draft_review_state !== 'unreviewed'
    && knowledgeRevision !== null
    && selected.draft_review_revision !== knowledgeRevision;
  const reviewLabel = selected.draft_review_state === 'unreviewed'
    ? 'Unreviewed'
    : knowledgeRevision === null
      ? 'Status unavailable'
      : reviewStale
        ? 'Out of date — knowledge changed'
        : selected.draft_review_state;
  const reviewTone = reviewStale || knowledgeRevision === null
    ? 'is-stale'
    : selected.draft_review_state === 'approved'
      ? 'is-approved'
      : selected.draft_review_state === 'rejected'
        ? 'is-rejected'
        : 'is-pending';
  const canCopy = canWrite
    && selected.draft_review_state === 'approved'
    && knowledgeRevision !== null
    && selected.draft_review_revision === knowledgeRevision;
  const configured = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL);

  return (
    <>
      <header className="detail-top">
        <p className="detail-kicker">
          Case review <span aria-hidden="true">·</span> {sourceLabel(selected.source_kind)}
        </p>
        <h2>{selected.subject}</h2>
        <p className="detail-meta">
          {selected.customer}
          <span aria-hidden="true">·</span>
          Ticket {selected.id.slice(0, 8)}
          <span aria-hidden="true">·</span>
          <span className="status-chip">{selected.ticket_status}</span>
        </p>
      </header>

      {error && <p className="notice notice-error" role="alert">{error}</p>}

      {!canWrite && (
        <p className="notice" role="status">
          {membershipError
            ? 'Your role could not be verified; editing is unavailable.'
            : 'Read-only access. You can inspect this case and its evidence.'}
        </p>
      )}

      {selected.source_kind === 'gmail' && (
        <p className="notice">
          Eligible for cleanup after {new Date(selected.expires_at ?? selected.created_at).toUTCString()};
          deletion depends on the configured retention worker.
        </p>
      )}

      <div className="detail-grid">
        <div className="detail-main">
          <article className="panel-card">
            <header className="card-head">
              <span className="card-index">01</span>
              <h3>Original message</h3>
            </header>
            <p className="message-quote">{selected.message}</p>
          </article>

          <article className="panel-card">
            <header className="card-head">
              <span className="card-index">02</span>
              <h3>Issue analysis and evidence</h3>
            </header>
            <Analysis
              key={selected.id}
              caseId={selected.id}
              configured={configured}
              canAnalyze={canWrite}
            />

            <div className="evidence-search">
              <div className="subsection-head">
                <h4>Workspace evidence</h4>
                <p>Search policy passages and review relevance yourself.</p>
              </div>
              <form method="get" className="field-form">
                <input type="hidden" name="case" value={selected.id} />
                <label htmlFor="evidence">Search knowledge</label>
                <div className="field-row">
                  <input id="evidence" name="evidence" maxLength={200} defaultValue={evidenceQuery} />
                  <button>Find passages</button>
                </div>
              </form>

              {evidenceError
                ? <p role="alert">Evidence search is unavailable. Check the knowledge migration.</p>
                : evidenceQuery
                  ? evidence.length
                    ? evidence.map(item => (
                      <div className="evidence-card" key={item.id}>
                        <strong>{item.title}</strong>
                        <p>{item.section} · Version {item.version}</p>
                        <p>{item.content}</p>
                        <a href={'/knowledge#document-' + encodeURIComponent(item.id)}>Open source</a>
                      </div>
                    ))
                    : <p>No matching passages. Human investigation is required.</p>
                  : null}
            </div>
          </article>

          <article className="panel-card">
            <header className="card-head">
              <span className="card-index">03</span>
              <h3>Reply draft</h3>
            </header>
            <form action={saveDraft} className="field-form">
              <input type="hidden" name="caseId" value={selected.id} />
              <label htmlFor="draft">{canWrite ? 'Editable draft (never sent)' : 'Draft (read only)'}</label>
              <textarea
                key={selected.id}
                id="draft"
                name="draft"
                rows={6}
                maxLength={5000}
                defaultValue={selected.draft}
                readOnly={!canWrite}
              />
              {canWrite && (
                <div className="button-row">
                  <button>Save draft</button>
                  {selected.draft.trim() && (
                    <>
                      <button formAction={approveDraft} className="secondary">Approve saved draft</button>
                      <button formAction={rejectDraft} className="secondary">Reject saved draft</button>
                    </>
                  )}
                </div>
              )}
            </form>

            <p className="review-line">
              Review: <strong className={`review-state ${reviewTone}`}>{reviewLabel}</strong>
              <span className="review-note">Save edits before reviewing. No email is sent.</span>
            </p>

            {canCopy && (
              <CopyDraft key={selected.id} caseId={selected.id} savedDraft={selected.draft} />
            )}
          </article>

          <article className="panel-card">
            <header className="card-head">
              <span className="card-index">04</span>
              <h3>Sandbox ticket</h3>
            </header>
            <p className="ticket-status">
              Ticket {selected.id.slice(0, 8)} · Current status:
              <span className="status-chip">{selected.ticket_status}</span>
            </p>

            {canWrite && (
              <form action={propose} className="field-form propose-form">
                <input type="hidden" name="caseId" value={selected.id} />
                <label htmlFor="status">Propose status</label>
                <div className="field-row">
                  <select
                    key={selected.id + selected.ticket_status}
                    name="status"
                    id="status"
                    defaultValue={selected.ticket_status === 'pending' ? 'open' : 'pending'}
                  >
                    <option value="open">Open</option>
                    <option value="pending">Pending</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  <button>Review change</button>
                </div>
              </form>
            )}

            <p className="sandbox-note">This sandbox update stays in Relay. No external CRM is connected.</p>

            <SandboxPanel
              caseId={selected.id}
              sourceKind={selected.source_kind}
              actions={actions}
              jobs={jobs}
              external={external}
              canWrite={canWrite}
            />
          </article>
        </div>

        <aside className="detail-side" aria-label="Case details">
          <section className="side-card">
            <h3>Case facts</h3>
            <dl className="facts">
              <div><dt>Status</dt><dd><span className="status-chip">{selected.ticket_status}</span></dd></div>
              <div><dt>Source</dt><dd>{sourceDetailLabel(selected.source_kind)}</dd></div>
              <div><dt>Opened</dt><dd><time dateTime={selected.created_at}>{formatDate(selected.created_at)}</time></dd></div>
              <div><dt>Case ID</dt><dd className="mono">{selected.id.slice(0, 8)}</dd></div>
              <div><dt>Knowledge</dt><dd>{knowledgeRevision === null ? 'Unavailable' : `Version ${knowledgeRevision}`}</dd></div>
            </dl>
          </section>

          <section className="side-card">
            <h3>Activity</h3>
            {detailsError
              ? <p>Activity is unavailable; check the pending migration.</p>
              : events.length
                ? (
                  <ol className="timeline">
                    {events.map(event => (
                      <li key={event.id}>
                        <span className="timeline-dot" aria-hidden="true" />
                        <div>
                          <strong>{event.event_type.replaceAll('_', ' ')}</strong>
                          <time dateTime={event.created_at}>{new Date(event.created_at).toUTCString()}</time>
                        </div>
                      </li>
                    ))}
                  </ol>
                )
                : <p>No activity yet.</p>}
          </section>

          <section className="side-card">
            <h3>Connections</h3>
            <dl className="facts">
              <div><dt>OpenAI</dt><dd>{configured ? 'Configured, unverified' : 'Not configured'}</dd></div>
              <div><dt>Gmail MCP</dt><dd><a href="/connections">See Connections</a></dd></div>
              <div><dt>Sandbox CRM</dt><dd>Local database simulation</dd></div>
            </dl>
          </section>

          {!membershipError && role === 'owner' && ['manual', 'gmail'].includes(selected.source_kind) && (
            <section className="side-card danger-zone">
              <h3>Delete request</h3>
              <p>
                This removes the request, its draft and related actions from this workspace.
                A minimal deletion record remains.
                {selected.source_kind === 'gmail' ? ' The original email remains in Gmail.' : ''}
              </p>
              <form action={deleteRequest} className="field-form">
                <input type="hidden" name="caseId" value={selected.id} />
                <label htmlFor="delete-confirmation">Type DELETE to confirm</label>
                <input id="delete-confirmation" name="confirmation" required pattern="DELETE" autoComplete="off" />
                <button className="danger">Delete request</button>
              </form>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
