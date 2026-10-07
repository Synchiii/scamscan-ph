import UiIcon from './UiIcon';

export const displayRole = (role) => ({ user: 'Member', staff: 'Staff', admin: 'Admin' }[role] || role);
export const displayStatus = (status) => ({ open: 'Open', 'in-progress': 'In progress', resolved: 'Resolved', draft: 'Draft', published: 'Published' }[status] || status);
export const dateLabel = (value, withTime = false) => value ? new Date(value).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }) : '—';
export const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
export function pageSlice(items, requestedPage = 1, limit = 10) {
  const pages = Math.max(1, Math.ceil(items.length / limit));
  const page = Math.min(pages, Math.max(1, requestedPage));
  return { rows: items.slice((page - 1) * limit, page * limit), page, pages };
}
export function textMatches(query, ...values) {
  const search = query.trim().toLowerCase();
  return !search || values.some((value) => String(value || '').toLowerCase().includes(search));
}
export function ConsolePage({ title, children, className = '' }) { return <section className={'console-page ' + className}><h1 className="visually-hidden">{title}</h1>{children}</section>; }
export function ConsolePanel({ title, detail, icon, action, children, className = '' }) {
  return <article className={'console-panel ' + className}>{title && <div className="console-panel-heading">{icon && <span className="console-icon"><UiIcon name={icon} size={19} /></span>}<div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action && <div className="console-heading-action">{action}</div>}</div>}{children}</article>;
}
export function ConsoleEmpty({ children, icon = 'file', loading = false }) { return <div className="console-empty" role={loading ? 'status' : undefined}><UiIcon name={icon} size={30} /><p>{children}</p></div>; }
export function ConsoleMetrics({ items, loading = false }) {
  return <div className="console-metrics" aria-busy={loading}>{items.map(({ label, value, icon, go }) => <article key={label} className="console-metric"><span className="console-metric-icon"><UiIcon name={icon} size={20} /></span><span>{label}</span><b>{loading ? '—' : value ?? '—'}</b>{go && <button type="button" onClick={go} aria-label={'Open ' + label}><UiIcon name="arrow" size={16} /></button>}</article>)}</div>;
}
export function ConsoleAction({ icon, title, description, onClick }) { return <button type="button" className="console-action" onClick={onClick}><span className="console-icon"><UiIcon name={icon} size={22} /></span><span><b>{title}</b><small>{description}</small></span><UiIcon name="chevron" size={17} /></button>; }
export function ConsoleSearch({ value, onChange, label, disabled = false }) { return <label className="console-search"><UiIcon name="search" size={18} /><span className="visually-hidden">{label}</span><input type="search" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={label} maxLength="200" /></label>; }
export function ConsolePager({ page, pages, total, limit = 10, onPage, busy = false }) {
  return <div className="console-pager"><span>{total ? (page - 1) * limit + 1 : 0}–{Math.min(page * limit, total)} of {total}</span><div><button type="button" disabled={busy || page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><UiIcon name="back" size={16} /><span>Previous</span></button><span>Page {page} of {pages}</span><button type="button" disabled={busy || page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><span>Next</span><UiIcon name="arrow" size={16} /></button></div></div>;
}
export function ConsoleChip({ value, label }) { return <span className={'console-chip ' + value}>{label || displayStatus(value)}</span>; }
export function ConsoleBarList({ rows = [], labelKey = '_id', valueKey = 'count' }) {
  const max = Math.max(...rows.map((row) => Number(row[valueKey]) || 0), 1);
  return <div className="console-bars">{rows.length ? rows.map((row, index) => <div className="console-bar" key={String(row[labelKey]) + index}><div><span>{row[labelKey] || 'Unknown'}</span><b>{row[valueKey]}</b></div><span className="console-bar-track"><i style={{ width: Math.max(0, Math.min(100, Number(row[valueKey]) / max * 100)) + '%' }} /></span></div>) : <ConsoleEmpty>No data yet.</ConsoleEmpty>}</div>;
}
export function FixedRows({ rows, render, columns, slots = 10, emptyMessage = 'No records found.', loading = false }) {
  return <tbody>{rows.map(render)}{Array.from({ length: Math.max(0, slots - rows.length) }, (_, index) => <tr className="console-placeholder" key={'empty-' + index} aria-hidden={index !== 0 || Boolean(rows.length)}><td colSpan={columns}>{index === 0 && !rows.length ? <span role={loading ? 'status' : undefined}>{loading ? 'Loading records…' : emptyMessage}</span> : <span aria-hidden="true">&nbsp;</span>}</td></tr>)}</tbody>;
}

const navIcons = { staffOverview: 'dashboard', adminOverview: 'dashboard', adminUsers: 'users', contents: 'file', chat: 'message', adminSupport: 'mail', profile: 'user', settings: 'settings', adminReports: 'shield', adminAnalytics: 'chart', adminAudit: 'clock', adminCyber: 'activity', adminEvents: 'edit', maintenance: 'power' };
export function ManagementSidebar({ entries, page, chatOpen, go, role }) {
  const groups = [{ label: 'Workspace', ids: ['staffOverview', 'adminOverview', 'adminUsers', 'adminReports', 'contents', 'adminSupport', 'chat'] }, { label: 'System', ids: ['adminAnalytics', 'adminAudit', 'adminCyber', 'adminEvents', 'maintenance'] }, { label: 'Account', ids: ['profile', 'settings'] }];
  const related = { adminAccountDetails: 'adminUsers', report: role === 'admin' ? 'adminReports' : 'adminUsers' };
  return <aside className="sidebar management-sidebar"><span className="management-role"><UiIcon name="shield" size={16} />{role === 'admin' ? 'Admin workspace' : 'Staff workspace'}</span>{groups.map((group) => {
    const links = entries.filter(([id]) => group.ids.includes(id));
    return links.length ? <div className="management-nav-group" key={group.label}><span className="side-label">{group.label}</span>{links.map(([id, label]) => {
      const selected = id === 'chat' ? chatOpen : id === page || id === related[page];
      return <button type="button" className={selected ? 'active' : ''} key={id} onClick={() => go(id)} aria-current={selected && id !== 'chat' ? 'page' : undefined} aria-expanded={id === 'chat' ? chatOpen : undefined}><UiIcon name={navIcons[id]} size={18} /><span>{label}</span></button>;
    })}</div> : null;
  })}<div className="management-session"><UiIcon name="lock" size={15} /><span>Protected session<small>Automatic sign-out · 30 min</small></span></div></aside>;
}
