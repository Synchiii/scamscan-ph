const levels = ['All', 'Scam', 'High', 'Warning', 'Safe'];
const pageSize = 10;

export function MemberOverview({ scanTotal, go }) {
  return <section className="member-overview member-home">
    <h1 className="visually-hidden">Overview</h1>
    <div className="detector-launch-panel">
      <div className="detector-launch-copy"><span className="label">THINK FIRST. SCAN SMARTER.</span><h2>Your next click<br />starts here.</h2><p>Check a message, website link, or screenshot. Understand the warning signs before you decide what to do.</p><div className="scan-type-pills"><span>Messages</span><span>Links</span><span>Screenshots</span></div><small>Risk scores are guidance, not proof that content is safe.</small></div>
      <div className="detector-launch-wrap"><button className="detector-launch" onClick={() => go('scanner')} aria-label="Open the scam detector form"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 24V12h12m16 0h12v12M12 40v12h12m16 0h12V40M10 32h44" /><path d="m24 40 6 6 12-14" /></svg><b>Start a scan</b><span>Open detector →</span></button><span className="launch-caption">One tap to check suspicious content</span></div>
    </div>
    <div className="member-status-strip"><div><b>{scanTotal}</b><span>Saved reports</span></div><div><b>Private</b><span>Your account history</span></div><div><b>30 min</b><span>Secure session limit</span></div></div>
    <div className="member-shortcuts">
      <button onClick={() => go('history')}><span className="shortcut-icon" aria-hidden="true">▤</span><span><b>Scan history</b><small>Review scores and full reports</small></span><span aria-hidden="true">↗</span></button>
      <button onClick={() => go('chat')}><span className="shortcut-icon" aria-hidden="true">◌</span><span><b>Chat with Staff</b><small>Get private help from our team</small></span><span aria-hidden="true">↗</span></button>
      <button onClick={() => go('help')}><span className="shortcut-icon" aria-hidden="true">✚</span><span><b>Recovery guide</b><small>Find practical next steps</small></span><span aria-hidden="true">↗</span></button>
    </div>
  </section>;
}

export function HistoryPage({ history, total, page, pages, level, setPage, setLevel, openReport, deleteScan, loading, busy }) {
  const rows = loading ? [] : history.slice(0, pageSize);
  const placeholders = Array.from({ length: pageSize - rows.length });
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);
  return <section className="scan-history-page">
    <h1 className="visually-hidden">Scan history</h1>
    <div className="history-toolbar"><div className="history-tabs" role="group" aria-label="Filter reports by risk level">{levels.map((tab) => <button type="button" key={tab} aria-pressed={level === tab} className={level === tab ? 'active' : ''} onClick={() => { setLevel(tab); setPage(1); }}>{tab}</button>)}</div><span className="history-page-size">10 reports per page</span></div>
    <div className="history-table-card">
      <div className="history-table-heading"><div><b>{level === 'All' ? 'All reports' : level + ' risk reports'}</b><span aria-live="polite">{loading ? 'Loading reports…' : total + ' saved report' + (total === 1 ? '' : 's')}</span></div><span className="label">ONLY VISIBLE TO YOU</span></div>
      <div className="history-table-shell" tabIndex="0" aria-label="Scroll the report table horizontally on a small screen" aria-busy={loading}>
        <table className="scan-history-table"><caption className="visually-hidden">Saved scam reports, ten per page. Use View to open a full report.</caption><colgroup><col className="report-content-col" /><col className="report-risk-col" /><col className="report-score-col" /><col className="report-date-col" /><col className="report-actions-col" /></colgroup><thead><tr><th scope="col">Submitted content</th><th scope="col">Risk level</th><th scope="col">Score</th><th scope="col">Date</th><th scope="col">Actions</th></tr></thead><tbody>
          {rows.map((item) => <tr key={item._id}><td><button className="history-report-title" onClick={() => openReport(item)} title={item.message}>{item.message}</button><span className="history-report-meta">{item.language} · {item.flags?.length || 0} signals</span></td><td><span className={'risk-badge ' + item.level.toLowerCase()}>{item.level}</span></td><td><b className="history-score">{item.score}<small>/100</small></b></td><td><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString()}<small>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></time></td><td><div className="history-row-actions"><button className="secondary" onClick={() => openReport(item)} aria-label={'View report from ' + new Date(item.createdAt).toLocaleString()}>View</button><button className="history-delete" disabled={busy} onClick={() => deleteScan(item._id)} aria-label={'Delete report from ' + new Date(item.createdAt).toLocaleString()} title="Delete report"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7" /></svg></button></div></td></tr>)}
          {placeholders.map((_, index) => <tr className="history-placeholder-row" key={'empty-' + index} aria-hidden={rows.length || index > 0 ? true : undefined}><td colSpan="5">{!rows.length && index === 0 ? <span className="history-empty-message">{loading ? 'Loading your saved reports…' : level === 'All' ? 'No reports yet. Run your first scan to get started.' : 'No reports match this risk level.'}</span> : <span aria-hidden="true">&nbsp;</span>}</td></tr>)}
        </tbody></table>
      </div>
      <div className="history-pagination"><span>{loading ? 'Loading…' : total ? 'Showing ' + start + '–' + end + ' of ' + total : 'Showing 0 reports'}</span><div><button className="secondary" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>← Previous</button><span aria-live="polite">Page {page} of {pages}</span><button className="secondary" disabled={loading || page >= pages} onClick={() => setPage(page + 1)}>Next →</button></div></div>
    </div>
  </section>;
}
