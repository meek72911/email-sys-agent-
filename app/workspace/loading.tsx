export default function WorkspaceLoading() {
  return (
    <div className="app-frame" aria-busy="true">
      <header className="app-header">
        <div className="app-header-inner">
          <span className="brand">
            <span className="brand-mark" aria-hidden="true"><span /><span /></span>
            Relay
          </span>
          <div className="header-skeleton" aria-hidden="true">
            <span /><span /><span /><span /><span />
          </div>
        </div>
      </header>
      <main className="workspace" id="main">
        <aside className="workspace-inbox" aria-label="Inbox loading">
          <div className="inbox-list">
            <p className="loading-label" role="status">Loading inbox…</p>
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-search" />
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
          </div>
        </aside>
        <section className="case-detail" aria-label="Case loading">
          <div className="skeleton skeleton-kicker" />
          <div className="skeleton skeleton-title skeleton-title-large" />
          <div className="skeleton skeleton-line skeleton-line-short" />
          <div className="skeleton skeleton-panel" />
          <div className="skeleton skeleton-panel" />
        </section>
      </main>
    </div>
  );
}
