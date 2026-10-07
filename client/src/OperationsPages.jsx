import { useEffect, useState } from 'react';
import { api } from './api';
import UiIcon from './UiIcon';
import { ConsolePage, ConsolePanel, ConsoleMetrics, ConsoleAction, ConsoleSearch, ConsolePager, ConsoleChip, ConsoleEmpty, pageSlice, textMatches, dateLabel } from './ManagementUI';

const blankContent = { title: '', body: '', category: 'guide', status: 'draft' };

export function PublishedContent({ contents }) {
  if (!contents.length) return null;
  return <section className="published-content"><span className="eyebrow">FROM THE SCAMSCAN TEAM</span><h2>Guides & updates</h2><div className="operations-grid">{contents.map((item) => <article className="panel" key={item._id}><span className="label">{item.category}</span><h3>{item.title}</h3><p className="preserve-lines">{item.body}</p><small>Updated {new Date(item.updatedAt).toLocaleDateString()}</small></article>)}</div></section>;
}


export function StaffOverview({ data, go, refresh, busy }) {
  const tasks = [['adminUsers', 'users', 'Manage users', 'Member details and account access.'], ['contents', 'file', 'Manage content', 'Safety guides, news and announcements.'], ['adminSupport', 'mail', 'Customer support', 'Private requests and helpful replies.'], ['chat', 'message', 'Member chat', 'Messages and shared attachments.']];
  return <ConsolePage title="Staff workspace"><ConsoleMetrics loading={!data} items={[
    { label: 'Member accounts', value: data?.users, icon: 'users', go: () => go('adminUsers') },
    { label: 'Content entries', value: data?.contents, icon: 'file', go: () => go('contents') },
    { label: 'Open requests', value: data?.openSupport, icon: 'mail', go: () => go('adminSupport') },
  ]} /><ConsolePanel title="Your tools" icon="dashboard" action={<button className="console-button" onClick={refresh} disabled={busy}><UiIcon name="refresh" size={16} />Refresh</button>}><div className="console-action-grid">{tasks.map(([page, icon, title, description]) => <ConsoleAction key={page} icon={icon} title={title} description={description} onClick={() => go(page)} />)}</div></ConsolePanel><div className="console-overview-grid"><ConsolePanel title="Support queue" icon="mail"><div className="console-queue-count"><b>{data?.openSupport ?? '—'}</b><span>requests awaiting a reply or resolution</span></div><button className="console-button" onClick={() => go('adminSupport')}>Open inbox<UiIcon name="arrow" size={16} /></button><p className="console-footnote">Replies are saved privately in each member's account.</p></ConsolePanel><ConsolePanel title="Your account" icon="user"><div className="console-tool-list"><ConsoleAction icon="user" title="My profile" description="Update your name and profile details." onClick={() => go('profile')} /><ConsoleAction icon="lock" title="Security settings" description="Password and notification preferences." onClick={() => go('settings')} /></div><p className="console-footnote">Member management only. Roles and system controls stay with Admin.</p></ConsolePanel></div></ConsolePage>;
}

export function ContentManager({ run, onPublishedChange }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(blankContent);
  const [id, setId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [requestedPage, setPage] = useState(1);
  useEffect(() => { let active = true; run(api.getContent, 0).then((result) => { if (active) { if (result) setItems(result.contents); setLoading(false); } }); return () => { active = false; }; }, []);
  const update = (field, value) => setForm((previous) => ({ ...previous, [field]: value }));
  const reset = () => { setId(null); setForm(blankContent); };
  async function save(event) {
    event.preventDefault(); if (saving) return; setSaving(true);
    const result = await run(() => api.saveContent(id, form)); setSaving(false);
    if (result) { setItems((list) => [result.content, ...list.filter((item) => item._id !== result.content._id)]); reset(); onPublishedChange(); }
  }
  async function remove(item) {
    if (saving || !window.confirm('Delete “' + item.title + '”?')) return;
    setSaving(true); const result = await run(() => api.deleteContent(item._id)); setSaving(false);
    if (result !== null) { setItems((list) => list.filter((entry) => entry._id !== item._id)); if (id === item._id) reset(); onPublishedChange(); }
  }
  const filtered = items.filter((item) => (filter === 'all' || item.status === filter) && textMatches(search, item.title, item.body, item.category));
  const { rows, page, pages } = pageSlice(filtered, requestedPage, 5);
  return <ConsolePage title="Content management"><div className="console-content-grid"><ConsolePanel title={id ? 'Edit content' : 'Create content'} detail="Draft first. Publish when it is ready." icon="edit" className="console-content-editor"><form className="console-form" onSubmit={save}><label>Title<input required minLength="3" maxLength="120" value={form.title} disabled={saving} onChange={(event) => update('title', event.target.value)} /></label><div className="console-form-grid"><label>Category<select value={form.category} disabled={saving} onChange={(event) => update('category', event.target.value)}><option value="guide">Guide</option><option value="announcement">Announcement</option><option value="news">News</option></select></label><label>Visibility<select value={form.status} disabled={saving} onChange={(event) => update('status', event.target.value)}><option value="draft">Draft</option><option value="published">Published</option></select></label></div><label>Content<textarea required minLength="10" maxLength="5000" rows="7" value={form.body} disabled={saving} onChange={(event) => update('body', event.target.value)} /></label><small className="console-muted">{form.body.length.toLocaleString()} / 5,000 characters</small><div className="console-form-actions">{id && <button type="button" className="console-button" disabled={saving} onClick={reset}>Cancel</button>}<button className="primary" disabled={saving}>{saving ? 'Saving…' : form.status === 'published' ? 'Save & publish' : 'Save draft'}</button></div></form></ConsolePanel><ConsolePanel title="Content library" detail={items.length + ' entries · latest 200 loaded'} icon="file" className="console-content-library"><div className="console-toolbar console-in-panel"><ConsoleSearch value={search} disabled={saving} label="Search content" onChange={(value) => { setSearch(value); setPage(1); }} /><label><span className="visually-hidden">Filter publication status</span><select value={filter} disabled={saving} onChange={(event) => { setFilter(event.target.value); setPage(1); }}><option value="all">All entries</option><option value="draft">Drafts</option><option value="published">Published</option></select></label></div><div className="console-content-list">{loading ? <ConsoleEmpty loading>Loading content…</ConsoleEmpty> : rows.length ? rows.map((item) => <article className={'console-content-item' + (id === item._id ? ' editing' : '')} key={item._id}><div><ConsoleChip value={item.status} /><small>{item.category} · {dateLabel(item.updatedAt)}</small></div><h3>{item.title}</h3><p>{item.body}</p><div className="console-row-actions"><button type="button" className="console-button" disabled={saving} onClick={() => { setId(item._id); setForm({ title: item.title, body: item.body, category: item.category, status: item.status }); }}><UiIcon name="edit" size={16} />Edit</button><button type="button" className="console-icon-button danger" disabled={saving} onClick={() => remove(item)} aria-label={'Delete ' + item.title}><UiIcon name="trash" size={17} /></button></div></article>) : <ConsoleEmpty>No entries match this view.</ConsoleEmpty>}</div><ConsolePager page={page} pages={pages} total={filtered.length} limit={5} onPage={setPage} busy={saving} /></ConsolePanel></div></ConsolePage>;
}

export function MaintenancePage({ run, onChange }) {
  const [settings, setSettings] = useState(null);
  const [savedMode, setSavedMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => { let active = true; run(api.getMaintenance, 0).then((result) => { if (active && result) { setSettings(result.settings); setSavedMode(result.settings.maintenanceEnabled); } }); return () => { active = false; }; }, []);
  async function save(event) { event.preventDefault(); if (saving) return; setSaving(true); const result = await run(() => api.updateMaintenance(settings)); setSaving(false); if (result) { setSettings(result.settings); setSavedMode(result.settings.maintenanceEnabled); onChange(result.settings); setNotice(result.settings.maintenanceEnabled ? 'Maintenance enabled. Only administrators can access the app.' : 'Maintenance off. Users and staff can access the app again.'); } }
  return <ConsolePage title="Maintenance mode"><div className="console-maintenance-grid"><ConsolePanel title="Access control" detail="Changes apply only after you save." icon="power">{settings ? <form className="console-form" onSubmit={save}><div className="console-maintenance-status"><span>Saved mode</span><ConsoleChip value={savedMode ? 'suspended' : 'active'} label={savedMode ? 'Maintenance on' : 'Available'} /></div><label className="console-switch"><span><b>Enable maintenance</b><small>Pause visitor, member and staff access.</small></span><input type="checkbox" role="switch" checked={settings.maintenanceEnabled} disabled={saving} onChange={(event) => { setSettings({ ...settings, maintenanceEnabled: event.target.checked }); setNotice(''); }} /></label><label>Public message<textarea minLength="10" maxLength="500" required rows="5" value={settings.maintenanceMessage} disabled={saving} onChange={(event) => { setSettings({ ...settings, maintenanceMessage: event.target.value }); setNotice(''); }} /></label><div className="console-form-actions"><small>Admin login and recovery stay available.</small><button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button></div>{notice && <p className="console-success" role="status">{notice}</p>}</form> : <ConsoleEmpty loading>Loading maintenance settings…</ConsoleEmpty>}</ConsolePanel><ConsolePanel title="Visitor preview" icon="shield"><div className="console-maintenance-preview"><span className="console-icon"><UiIcon name="shield" size={32} /></span><h3>We’ll be back soon.</h3><p>{settings?.maintenanceMessage || 'Your maintenance message will appear here.'}</p><span className="console-chip">Preview only</span></div><p className="console-footnote">Enabling maintenance does not delete accounts, reports or conversations.</p></ConsolePanel></div></ConsolePage>;
}

export function MaintenanceScreen({ message, go, refresh }) {
  return <main className="maintenance-screen"><article className="panel"><span className="eyebrow">SCAMSCAN · MAINTENANCE</span><h1>We’ll be back soon.</h1><p>{message}</p><div className="account-actions"><button className="primary" onClick={refresh}>Check again</button><button className="secondary" onClick={() => go('login')}>Administrator sign in</button></div></article></main>;
}
