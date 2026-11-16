import type { Metadata } from 'next';
import Link from 'next/link';
import AppHeader from '@/app/ui/app-header';
import { isDemoEmail } from '@/lib/demo';
import { requireUser } from '@/lib/session';
import { deleteWorkspace } from './actions';

export const metadata: Metadata = { title: 'Settings' };

export default async function Settings({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { client, user } = await requireUser();
  const { data: membership, error: membershipError } = await client
    .from('memberships')
    .select('org_id,role')
    .eq('user_id', user.id)
    .maybeSingle();
  const { error: actionError } = await searchParams;

  return (
    <div className="app-frame">
      <AppHeader current="/settings" email={user.email} demo={isDemoEmail(user.email)} />
      <main className="content-page" id="main">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/workspace">Workspace</Link>
          <span aria-hidden="true">/</span>
          <span>Settings</span>
        </nav>

        <header className="page-head">
          <p className="page-kicker">Workspace</p>
          <h1>Workspace settings</h1>
          <p>Membership and destructive actions for this workspace.</p>
        </header>

        {membershipError
          ? <p className="notice notice-error" role="alert">Workspace settings are unavailable.</p>
          : !membership
            ? <div className="state-card"><h2>No workspace exists for this account.</h2><p>Create a workspace from the inbox to begin.</p></div>
            : (
              <>
                <section className="connection-card">
                  <header className="connection-head">
                    <div>
                      <h2>Membership</h2>
                      <p>Your access level in this workspace</p>
                    </div>
                    <span className="status-chip">{membership.role}</span>
                  </header>
                  <p>
                    Owners can manage workspace deletion and knowledge sources. Operators can review
                    drafts and ticket changes. Viewers have read-only access.
                  </p>
                </section>

                <section className="connection-card danger-zone">
                  <header className="connection-head">
                    <div>
                      <h2>Delete workspace</h2>
                      <p>Permanent removal</p>
                    </div>
                  </header>
                  <p>
                    This removes this workspace’s cases, drafts, knowledge, actions and activity from Relay.
                    Your sign-in account remains. This cannot be undone.
                  </p>
                  <p>
                    Deletion is blocked if a separate CRM dispatch exists, because its records require
                    coordinated cleanup that is not implemented yet.
                  </p>

                  {membership.role === 'owner'
                    ? (
                      <form action={deleteWorkspace} className="field-form">
                        <input type="hidden" name="orgId" value={membership.org_id} />
                        <label htmlFor="confirmation">Type DELETE to confirm</label>
                        <input id="confirmation" name="confirmation" required autoComplete="off" pattern="DELETE" />
                        <button className="danger">Delete workspace</button>
                      </form>
                    )
                    : <p className="field-note">Only a workspace owner can delete it.</p>}

                  {actionError && (
                    <p className="notice notice-error" role="alert">
                      {actionError === 'confirmation'
                        ? 'Type DELETE to confirm.'
                        : 'Deletion failed. Check owner access and whether external sandbox records require cleanup.'}
                    </p>
                  )}
                </section>
              </>
            )}
      </main>
    </div>
  );
}
