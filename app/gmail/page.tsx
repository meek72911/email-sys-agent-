import type { Metadata } from 'next';
import Link from 'next/link';
import AppHeader from '@/app/ui/app-header';
import { isDemoEmail } from '@/lib/demo';
import { gmailImportEnabled } from '@/lib/gmail/import-config';
import { requireUser } from '@/lib/session';
import Mailbox from './mailbox';

export const metadata: Metadata = { title: 'Gmail import' };

export default async function GmailPage() {
  const { client, user } = await requireUser();
  const { data: member, error: memberError } = await client
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <div className="app-frame">
      <AppHeader current="/connections" email={user.email} demo={isDemoEmail(user.email)} />
      <main className="content-page content-narrow" id="main">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/connections">Connections</Link>
          <span aria-hidden="true">/</span>
          <span>Gmail import</span>
        </nav>

        <header className="page-head">
          <p className="page-kicker">Read-only import</p>
          <h1>Gmail import</h1>
          <p>Search the connected mailbox and copy a single message into this workspace.</p>
        </header>

        {!memberError && member?.role === 'owner' && gmailImportEnabled()
          ? <Mailbox />
          : <div className="state-card"><h2>Gmail import is unavailable.</h2><p>An owner must complete connection, access review and retention setup first.</p></div>}
      </main>
    </div>
  );
}
