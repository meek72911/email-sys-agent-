import type { Metadata } from 'next';
import Link from 'next/link';
import AppHeader from '@/app/ui/app-header';
import { isDemoEmail } from '@/lib/demo';
import { requireUser } from '@/lib/session';
import { uploadKnowledge, replaceKnowledge, deleteKnowledge } from './actions';

export const metadata: Metadata = { title: 'Knowledge' };

type Document = {
  id: string;
  document_id: string;
  title: string;
  section: string;
  content: string;
  version: number;
};

export default async function Knowledge({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; uploaded?: string; replaced?: string; deleted?: string }>;
}) {
  const { client, user } = await requireUser();
  const { data: membership } = await client
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  const { q = '', error, uploaded, replaced, deleted } = await searchParams;
  const query = (typeof q === 'string' ? q : '').trim().slice(0, 200);
  const result = query
    ? await client.rpc('relay_search_knowledge', { p_query: query })
    : await client.from('knowledge_documents').select('id,document_id,title,section,content,version').order('title');

  const documents = (result.data ?? []) as Document[];
  const groups = new Map<string, Document[]>();
  for (const document of documents) {
    groups.set(document.document_id, [...(groups.get(document.document_id) ?? []), document]);
  }

  return (
    <div className="app-frame">
      <AppHeader current="/knowledge" email={user.email} demo={isDemoEmail(user.email)} />
      <main className="content-page" id="main">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/workspace">Workspace</Link>
          <span aria-hidden="true">/</span>
          <span>Knowledge</span>
        </nav>

        <header className="page-head">
          <p className="page-kicker">Workspace library</p>
          <h1>Knowledge</h1>
          <p>
            Search this workspace’s policy passages. Customer messages and uploaded documents
            are treated as untrusted content.
          </p>
        </header>

        {membership?.role === 'owner' && (
          <form action={uploadKnowledge} className="panel-form upload-form">
            <div className="form-head">
              <h2>Add a source</h2>
              <p>Adding knowledge invalidates older reviews, so proposed actions must be reviewed again.</p>
            </div>
            <label htmlFor="file">Add a PDF or UTF-8 text file</label>
            <input id="file" name="file" type="file" accept=".pdf,.txt" required />
            <p className="field-note">
              Maximum 2 MB. PDF pages must contain selectable text; scanned or blank pages are not supported.
            </p>
            <button>Add document</button>
          </form>
        )}

        {error && <p className="notice notice-error" role="alert">{error}</p>}
        {uploaded && <p className="notice" role="status">Document text added to this workspace.</p>}
        {replaced && <p className="notice" role="status">Document replaced. Review actions again before approval or execution.</p>}
        {deleted && <p className="notice" role="status">Document deleted. Review actions again before approval or execution.</p>}

        <form method="get" className="panel-form search-form">
          <label htmlFor="q">Search documents</label>
          <div className="field-row">
            <input id="q" name="q" maxLength={200} defaultValue={query} placeholder="Invoice, login, export…" />
            <button>Search</button>
          </div>
        </form>

        {result.error
          ? <p className="notice notice-error" role="alert">Knowledge is unavailable. Apply the pending database migrations.</p>
          : documents.length
            ? [...groups.entries()].map(([id, parts]) => (
              <article className="knowledge-card" key={id} id={'knowledge-' + id}>
                <header className="knowledge-head">
                  <div>
                    <h2>{parts[0].title}</h2>
                    <p>{parts.length} {parts.length === 1 ? 'passage' : 'passages'}</p>
                  </div>
                  <span className="version-chip">Version {parts[0].version}</span>
                </header>

                {parts.map(part => (
                  <section className="knowledge-passage" key={part.id} id={'document-' + part.id}>
                    <h3>{part.section}</h3>
                    <p>{part.content}</p>
                  </section>
                ))}

                {membership?.role === 'owner' && (
                  <details className="danger-details">
                    <summary>Replace document</summary>
                    <p>Replacing a document removes its previous extracted text and invalidates older action approvals.</p>
                    <form action={replaceKnowledge} className="field-form">
                      <input type="hidden" name="documentId" value={id} />
                      <label htmlFor={'file-' + id}>New PDF or text file</label>
                      <input id={'file-' + id} name="file" type="file" accept=".pdf,.txt" required />
                      <button>Replace document</button>
                    </form>
                  </details>
                )}

                {membership?.role === 'owner' && (
                  <details className="danger-details">
                    <summary>Delete document</summary>
                    <p>This removes all its extracted passages and invalidates older reviews. This cannot be undone.</p>
                    <form action={deleteKnowledge} className="field-form">
                      <input type="hidden" name="documentId" value={id} />
                      <label htmlFor={'delete-' + id}>Type DELETE to confirm</label>
                      <input id={'delete-' + id} name="confirmation" required pattern="DELETE" autoComplete="off" />
                      <button className="secondary">Delete document</button>
                    </form>
                  </details>
                )}
              </article>
            ))
            : <div className="state-card"><h2>No matching passages.</h2><p>Try a different term or add a source.</p></div>}
      </main>
    </div>
  );
}
