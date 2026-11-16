export default function Loading() {
  return (
    <div className="app-frame" aria-busy="true">
      <header className="app-header">
        <div className="app-header-inner">
          <span className="brand">
            <span className="brand-mark" aria-hidden="true"><span /><span /></span>
            Relay
          </span>
          <div className="header-skeleton" aria-hidden="true">
            <span /><span /><span /><span />
          </div>
        </div>
      </header>
      <main className="content-page" id="main">
        <p className="loading-label" role="status">Loading Relay…</p>
        <div className="skeleton skeleton-kicker" />
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line skeleton-line-short" />
        <div className="skeleton skeleton-panel" />
        <div className="skeleton skeleton-panel" />
      </main>
    </div>
  );
}
