import { jobFailureMessage, mayRetryJob } from '@/lib/job-status';
import {
  approve,
  checkExternalSandbox,
  enqueueExecution,
  execute,
  queueExternalSandbox,
  reject,
  retryExecution,
} from './actions';
import type { ActionRow, ExternalRow, JobRow } from './types';

export default function SandboxPanel({
  caseId,
  sourceKind,
  actions,
  jobs,
  external,
  canWrite,
}: {
  caseId: string;
  sourceKind: string;
  actions: ActionRow[];
  jobs: JobRow[];
  external: ExternalRow[];
  canWrite: boolean;
}) {
  return (
    <>
      {actions.map(action => (
        <div className="action" key={action.id}>
          <div className="action-head">
            <div>
              <span className="action-ticket">Ticket {caseId.slice(0, 8)}</span>
              <strong>{action.from_status} → {action.to_status}</strong>
            </div>
            <span className="state-chip">{action.state.replaceAll('_', ' ')}</span>
          </div>

          {canWrite && action.state === 'needs_approval' && (
            <div className="button-row">
              <form action={approve}>
                <input type="hidden" name="caseId" value={caseId} />
                <input type="hidden" name="actionId" value={action.id} />
                <input type="hidden" name="from" value={action.from_status} />
                <input type="hidden" name="to" value={action.to_status} />
                <button>Approve exact change</button>
              </form>
              <form action={reject}>
                <input type="hidden" name="caseId" value={caseId} />
                <input type="hidden" name="actionId" value={action.id} />
                <input type="hidden" name="from" value={action.from_status} />
                <input type="hidden" name="to" value={action.to_status} />
                <button className="secondary">Reject change</button>
              </form>
            </div>
          )}

          {jobs.filter(job => job.action_id === action.id).map(job => (
            <div className="job" key={job.id}>
              <p className="job-state">
                Background job: <strong>{job.state}</strong>
                {job.state === 'queued' ? ' — awaiting a confirmed result.' : ''}
              </p>
              <p className="job-time">
                Queued <time dateTime={job.created_at}>{new Date(job.created_at).toUTCString()}</time>
                {job.finished_at && (
                  <> · Finished <time dateTime={job.finished_at}>{new Date(job.finished_at).toUTCString()}</time></>
                )}
              </p>
              {job.state === 'failed' && <p className="job-failure">{jobFailureMessage(job.failure_code)}</p>}
              {canWrite
                && job.state === 'failed'
                && mayRetryJob(job.failure_code)
                && action.state === 'approved'
                && jobs.find(other => other.action_id === action.id)?.id === job.id
                && !jobs.some(other => other.action_id === action.id && other.state === 'queued')
                && !external.some(dispatch => dispatch.id === action.id) && (
                  <form action={retryExecution}>
                    <input type="hidden" name="caseId" value={caseId} />
                    <input type="hidden" name="jobId" value={job.id} />
                    <button className="secondary">Retry background action</button>
                  </form>
                )}
            </div>
          ))}

          {external.filter(dispatch => dispatch.id === action.id).map(dispatch => (
            <div className="job" key={dispatch.id}>
              <p className="job-state">
                Separate sandbox action: <strong>{dispatch.state.replaceAll('_', ' ')}</strong>
                {['dispatching', 'needs_reconciliation'].includes(dispatch.state)
                  ? ' — outcome not yet confirmed.'
                  : ''}
                {dispatch.state === 'succeeded' && dispatch.sync_state === 'conflict'
                  ? ' — external update succeeded, but the local ticket differs and needs review.'
                  : ''}
              </p>
              {canWrite && ['dispatching', 'needs_reconciliation'].includes(dispatch.state) && (
                <form action={checkExternalSandbox}>
                  <input type="hidden" name="caseId" value={caseId} />
                  <input type="hidden" name="actionId" value={action.id} />
                  <button className="secondary">Check sandbox result</button>
                </form>
              )}
            </div>
          ))}

          {canWrite
            && sourceKind === 'synthetic'
            && action.state === 'approved'
            && !external.some(dispatch => dispatch.id === action.id) && (
              <form action={queueExternalSandbox}>
                <input type="hidden" name="caseId" value={caseId} />
                <input type="hidden" name="actionId" value={action.id} />
                <button className="secondary">Send to separate sandbox</button>
              </form>
            )}

          {canWrite && action.state === 'approved' && !external.some(dispatch => dispatch.id === action.id) && (
            <div className="button-row">
              <form action={execute}>
                <input type="hidden" name="caseId" value={caseId} />
                <input type="hidden" name="actionId" value={action.id} />
                <button>Execute sandbox change now</button>
              </form>
              <form action={enqueueExecution}>
                <input type="hidden" name="caseId" value={caseId} />
                <input type="hidden" name="actionId" value={action.id} />
                <button className="secondary">Queue background execution</button>
              </form>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
