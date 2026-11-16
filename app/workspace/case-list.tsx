"use client";

import { useEffect, useMemo, useRef, useState } from 'react';

type CaseItem = {
  id: string;
  customer: string;
  subject: string;
  message: string;
  ticket_status: string;
};

export default function CaseList({
  cases,
  selectedId,
  canWrite,
}: {
  cases: CaseItem[];
  selectedId?: string;
  canWrite: boolean;
}) {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase();
    return value
      ? cases.filter(item => `${item.customer} ${item.subject} ${item.message}`.toLocaleLowerCase().includes(value))
      : cases;
  }, [cases, query]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) {
        return;
      }

      if (event.key === '/' && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (!['j', 'k'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;

      const links = Array.from(listRef.current?.querySelectorAll<HTMLAnchorElement>('a[data-case]') ?? []);
      if (!links.length) return;

      const current = links.indexOf(document.activeElement as HTMLAnchorElement);
      const next = current < 0
        ? Math.max(0, links.findIndex(link => link.dataset.case === selectedId))
        : Math.min(links.length - 1, Math.max(0, current + (event.key === 'j' ? 1 : -1)));

      event.preventDefault();
      links[next]?.focus();
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, filtered]);

  function guardUnsaved(event: React.MouseEvent<HTMLAnchorElement>) {
    const field = document.getElementById('draft');
    if (field instanceof HTMLTextAreaElement && field.value !== field.defaultValue && !window.confirm('Discard unsaved changes to this draft?')) {
      event.preventDefault();
    }
  }

  return (
    <div className="inbox-list">
      <header className="inbox-title">
        <div>
          <p className="inbox-eyebrow">Workspace</p>
          <h1>Inbox</h1>
          <p>Requests waiting for review.</p>
        </div>
        <span className="count" aria-live="polite">{filtered.length}</span>
      </header>

      <div className="inbox-actions">
        {canWrite && (
          <a className="button button-small" href="/cases/new" onClick={guardUnsaved}>Add request</a>
        )}
        <a className="button secondary button-small" href="/search" onClick={guardUnsaved}>Search all requests</a>
      </div>

      <label className="search-label" htmlFor="case-search">
        Filter recent requests <span aria-hidden="true">/</span>
      </label>
      <div className="search-wrap">
        <svg aria-hidden="true" viewBox="0 0 20 20" width="15" height="15" fill="none">
          <circle cx="8.5" cy="8.5" r="5.25" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12.4 12.4 16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          ref={searchRef}
          id="case-search"
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Name, subject or message"
          autoComplete="off"
        />
      </div>

      <div className="case-list" ref={listRef} aria-label="Customer requests">
        {filtered.length
          ? filtered.map(item => (
            <a
              key={item.id}
              href={'/workspace?case=' + encodeURIComponent(item.id) + '#case-detail'}
              data-case={item.id}
              onClick={guardUnsaved}
              aria-current={item.id === selectedId ? 'page' : undefined}
              className={'case' + (item.id === selectedId ? ' selected' : '')}
            >
              <span className="case-heading">
                <strong>{item.customer}</strong>
                <span className="status-chip">{item.ticket_status}</span>
              </span>
              <span className="case-subject">{item.subject}</span>
              <span className="case-preview">{item.message}</span>
            </a>
          ))
          : <p className="empty-state">No matching requests.</p>}
      </div>

      <p className="keyboard-hint">Press / to search. Use j and k to focus a request, then Enter to open it.</p>
    </div>
  );
}
