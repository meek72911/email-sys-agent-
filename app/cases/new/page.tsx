import type { Metadata } from 'next';
import Link from 'next/link';
import AppHeader from '@/app/ui/app-header';
import { isDemoEmail } from '@/lib/demo';
import { canOperate } from '@/lib/roles';
import { requireUser } from '@/lib/session';
import IntakeForm from './intake-form';

export const metadata: Metadata = { title: 'Add a request' };

export default async function NewCase() {
  const { client, user } = await requireUser();
  const { data: member, error } = await client
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <div className="app-frame">
      <AppHeader current="/workspace" email={user.email} demo={isDemoEmail(user.email)} />
      <main className="content-page content-narrow" id="main">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/workspace">Workspace</Link>
          <span aria-hidden="true">/</span>
          <span>Add a request</span>
        </nav>

        <header className="page-head">
          <p className="page-kicker">Manual intake</p>
          <h1>Add a request</h1>
          <p>Create a synthetic request for review. It stays inside this workspace.</p>
        </header>

        {!error && canOperate(member?.role)
          ? <IntakeForm />
          : <div className="state-card"><h2>Request intake is unavailable.</h2><p>Only workspace owners and operators can add requests. Create a workspace first if you do not have one.</p></div>}
      </main>
    </div>
  );
}
