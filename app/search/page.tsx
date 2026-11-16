import type { Metadata } from 'next';
import Link from 'next/link';
import AppHeader from '@/app/ui/app-header';
import { isDemoEmail } from '@/lib/demo';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Find requests' };

type Result = {
  id: string;
  customer: string;
  subject: string;
  created_at: string;
  ticket_status: string;
  source_kind: string;
};

function searchUrl(query: string, page: number) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (page > 1) params.set('page', String(page));
  const suffix = params.toString();
  return '/search' + (suffix ? '?' + suffix : '');
}

function sourceLabel(sourceKind: string) {
  if (sourceKind === 'gmail') return 'Gmail import';
  if (sourceKind === 'manual') return 'Manual request';
  return 'Synthetic request';
}

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { client, user } = await requireUser();
  const params = await searchParams;
  const query = (typeof params.q === 'string' ? params.q : '').trim().slice(0, 200);
  const candidate = Number(params.page ?? '1');
  const page = Number.isInteger(candidate) && candidate >= 1 && candidate <= 201 ? candidate : 1;
  const result = await client.rpc('relay_search_cases', { p_query: query, p_offset: (page - 1) * 50 });
  const all = (result.data ?? []) as Result[];
  const rows = all.slice(0, 50);
  const hasMore = all.length > 50;
  const hasNext = hasMore && page < 201;

  return (
    <div className="app-frame">
      <AppHeader current="/workspace" email={user.email} demo={isDemoEmail(user.email)} />
      <main className="content-page" id="main">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/workspace">Workspace</Link>
          <span aria-hidden="true">/</span>
          <span>Find requests</span>
        </nav>

        <header className="page-head">
          <p className="page-kicker">Search</p>
          <h1>Find requests</h1>
          <p>Search every request in this workspace. Open one to review its draft and evidence.</p>
        </header>

        <form method="get" className="panel-form search-form">
          <label htmlFor="q">Search all workspace requests</label>
          <div className="field-row">
            <input id="q" name="q" type="search" maxLength={200} defaultValue={query} placeholder="Customer, subject or message" />
            <button>Search</button>
          </div>
          <p className="field-note">Search terms may appear in your browser history.</p>
        </form>

        {result.error
          ? <p className="notice notice-error" role="alert">Search is unavailable. Check the database connection and migrations.</p>
          : rows.length
            ? (
              <>
                <p className="result-count" aria-live="polite">
                  {rows.length} {rows.length === 1 ? 'request' : 'requests'} on this page
                </p>
                <ol className="activity-list">
                  {rows.map(row => (
                    <li key={row.id}>
                      <div>
                        <strong>{row.subject}</strong>
                        <p>
                          {row.customer}
                          <span aria-hidden="true"> · </span>
                          {row.ticket_status}
                          <span aria-hidden="true"> · </span>
                          {sourceLabel(row.source_kind)}
                        </p>
                      </div>
                      <Link href={'/workspace?case=' + encodeURIComponent(row.id)}>Open request</Link>
                    </li>
                  ))}
                </ol>
              </>
            )
            : <div className="state-card"><h2>No requests found.</h2><p>Try a customer name, a subject, or a phrase from the message.</p></div>}

        <nav className="pagination" aria-label="Search result pages">
          {page > 1 && <Link href={searchUrl(query, page - 1)}>Previous page</Link>}
          {hasNext && <Link href={searchUrl(query, page + 1)}>Next page</Link>}
        </nav>
        <p className="result-page">Page {page}</p>
        {hasMore && !hasNext && <p>Refine the search to see more specific results.</p>}
      </main>
    </div>
  );
}
