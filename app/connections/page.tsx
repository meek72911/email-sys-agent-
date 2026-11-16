import type { Metadata } from 'next';
import Link from 'next/link';
import AppHeader from '@/app/ui/app-header';
import { isDemoEmail } from '@/lib/demo';
import { gmailConfig } from '@/lib/gmail/config';
import { gmailImportEnabled } from '@/lib/gmail/import-config';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Connections' };

export default async function Connections({ searchParams }: { searchParams: Promise<{ gmail?: string }> }) {
  const { client, user } = await requireUser();
  const { data: member, error: memberError } = await client
    .from('memberships')
    .select('org_id,role')
    .eq('user_id', user.id)
    .maybeSingle();

  const statusResult = member ? await client.rpc('relay_gmail_status', { p_org: member.org_id }) : null;
  const status = memberError || statusResult?.error ? 'unknown' : statusResult?.data ?? 'not_configured';
  const owner = !memberError && member?.role === 'owner';
  const connectReady = !!gmailConfig();
  const disconnectReady = !!gmailConfig(false);
  const { gmail } = await searchParams;

  const statusLabel = status === 'active'
    ? 'Authorization saved, connection unverified'
    : status === 'revocation_pending'
      ? 'Disconnect pending — remote revocation not confirmed'
      : status === 'disconnected'
        ? 'Disconnected'
        : status === 'unknown'
          ? 'Unavailable'
          : 'Not configured';

  return (
    <div className="app-frame">
      <AppHeader current="/connections" email={user.email} demo={isDemoEmail(user.email)} />
      <main className="content-page" id="main">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/workspace">Workspace</Link>
          <span aria-hidden="true">/</span>
          <span>Connections</span>
        </nav>

        <header className="page-head">
          <p className="page-kicker">External services</p>
          <h1>Connections</h1>
          <p>A connection can be configured without being verified. The status below says which one applies.</p>
        </header>

        <article className="connection-card">
          <header className="connection-head">
            <div>
              <h2>OpenAI</h2>
              <p>Optional live analysis</p>
            </div>
            <span className={`status-chip ${process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL ? '' : 'is-muted'}`}>
              {process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL ? 'Configured' : 'Not configured'}
            </span>
          </header>
          <p>
            {process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL
              ? 'Configured; connection not yet verified. Live extraction requires available quota.'
              : 'Not configured. Live extraction is unavailable.'}
            {' '}Generated drafts require human review.
          </p>
        </article>

        <article className="connection-card">
          <header className="connection-head">
            <div>
              <h2>Gmail MCP</h2>
              <p>Read-only import</p>
            </div>
            <span className="status-chip">{statusLabel}</span>
          </header>
          <p>
            Google authorization is separate from signing in to Relay. Gmail read-only access can cover
            the entire mailbox; selecting messages in Relay does not narrow the underlying permission.
            No email is sent.
          </p>

          {gmail === 'connected' && <p className="notice" role="status">Authorization saved. Mailbox access has not yet been verified.</p>}
          {gmail === 'denied' && <p className="notice" role="status">Google authorization was cancelled.</p>}
          {gmail === 'failed' && <p className="notice notice-error" role="alert">Authorization failed. If Google granted access, review and revoke it in your Google account before retrying.</p>}
          {gmail === 'disconnect_failed' && <p className="notice notice-error" role="alert">Disconnect could not be confirmed. Review Google account permissions.</p>}
          {gmail === 'revocation_pending' && <p className="notice notice-error" role="alert">Local use is blocked, but remote revocation was not confirmed. Retry or revoke access in your Google account.</p>}

          <div className="button-row">
            {owner && connectReady && ['not_configured', 'disconnected'].includes(status) && (
              <form action="/api/connections/gmail/start" method="post">
                <button>Authorize Gmail read-only</button>
              </form>
            )}
            {owner && disconnectReady && ['active', 'revocation_pending'].includes(status) && (
              <form action="/api/connections/gmail/disconnect" method="post">
                <button className="secondary">
                  {status === 'revocation_pending' ? 'Retry Gmail disconnect' : 'Disconnect Gmail'}
                </button>
              </form>
            )}
          </div>

          {owner && status === 'active' && gmailImportEnabled() && (
            <p><Link href="/gmail">Search and import messages</Link></p>
          )}
          {!connectReady && <p className="field-note">Connection is disabled until setup and access review are complete.</p>}
        </article>

        <article className="connection-card">
          <header className="connection-head">
            <div>
              <h2>Sandbox CRM</h2>
              <p>Local ticket simulation</p>
            </div>
            <span className="status-chip">Local</span>
          </header>
          <p>
            Local database simulation. The first-party REST and MCP interfaces are implemented;
            hosted integration has not been verified.
          </p>
        </article>
      </main>
    </div>
  );
}
