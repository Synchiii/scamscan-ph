import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

let server, pages, chat, operations, detector, recovery, profile, widget, media, management, consoleUI;
before(async () => {
  server = await createServer({ configFile: false, root: fileURLToPath(new URL('../../client/', import.meta.url)), plugins: [react()], server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  pages = await server.ssrLoadModule('/src/MemberPages.jsx');
  chat = await server.ssrLoadModule('/src/ChatPage.jsx');
  operations = await server.ssrLoadModule('/src/OperationsPages.jsx');
  detector = await server.ssrLoadModule('/src/DetectorPage.jsx');
  recovery = await server.ssrLoadModule('/src/RecoveryPage.jsx');
  profile = await server.ssrLoadModule('/src/ProfilePage.jsx');
  widget = await server.ssrLoadModule('/src/ChatWidget.jsx');
  media = await server.ssrLoadModule('/src/chatMedia.js');
  management = await server.ssrLoadModule('/src/ManagementPages.jsx');
  consoleUI = await server.ssrLoadModule('/src/ManagementUI.jsx');
});
after(async () => { await server?.close(); });
function elements(tree, predicate) {
  const found = [];
  function visit(node) {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!React.isValidElement(node)) return;
    if (predicate(node)) found.push(node);
    visit(node.props.children);
  }
  visit(tree); return found;
}
function report(index) {
  return { _id: 'report-' + index, message: 'Suspicious message ' + index, language: 'English', score: 75, level: 'High', flags: ['Urgency'], createdAt: '2026-10-07T03:00:00.000Z' };
}
function historyProps(overrides = {}) {
  return { history: [], total: 0, page: 1, pages: 1, level: 'All', setPage: () => {}, setLevel: () => {}, openReport: () => {}, deleteScan: () => {}, loading: false, busy: false, ...overrides };
}

test('large circular overview button opens the detector and chat shortcut opens Staff chat', () => {
  const destinations = [];
  const tree = pages.MemberOverview({ user: { name: 'Alex Student' }, scanTotal: 11, go: (page) => destinations.push(page) });
  const launcher = elements(tree, (node) => node.props.className === 'detector-launch')[0];
  assert.equal(launcher.type, 'button'); assert.match(launcher.props['aria-label'], /detector form/);
  launcher.props.onClick();
  const buttons = elements(tree, (node) => node.type === 'button');
  const chatButton = buttons.find((button) => renderToStaticMarkup(button).includes('Chat with Staff'));
  chatButton.props.onClick();
  assert.deepEqual(destinations, ['scanner', 'chat']);
  assert.doesNotMatch(renderToStaticMarkup(tree), /Hello,|A suspicious message\? Start with one careful check\./);
});
test('history keeps ten row slots for loading, empty, filtered, partial, and full pages', () => {
  for (const props of [historyProps(), historyProps({ loading: true }), historyProps({ level: 'Safe' }), historyProps({ history: [report(1)], total: 11, page: 2, pages: 2 }), historyProps({ history: Array.from({ length: 10 }, (_, index) => report(index)), total: 10 })]) {
    const tree = pages.HistoryPage(props);
    const body = elements(tree, (node) => node.type === 'tbody')[0];
    assert.equal(elements(body, (node) => node.type === 'tr').length, 10);
    assert.equal(elements(tree, (node) => node.type === 'col').length, 5);
    assert.match(renderToStaticMarkup(tree), /10 reports per page/);
  }
});
test('history filters reset pagination and Next opens the eleventh report page', () => {
  const changes = [];
  const tree = pages.HistoryPage(historyProps({ history: Array.from({ length: 10 }, (_, index) => report(index)), total: 11, pages: 2, setPage: (value) => changes.push(['page', value]), setLevel: (value) => changes.push(['level', value]) }));
  const buttons = elements(tree, (node) => node.type === 'button');
  const next = buttons.find((button) => button.props.children === 'Next →');
  assert.equal(next.props.disabled, false); next.props.onClick();
  const safe = buttons.find((button) => button.props.children === 'Safe');
  safe.props.onClick();
  assert.deepEqual(changes, [['page', 2], ['level', 'Safe'], ['page', 1]]);
  const last = pages.HistoryPage(historyProps({ history: [report(11)], total: 11, page: 2, pages: 2 }));
  assert.equal(elements(last, (node) => node.type === 'button' && node.props.children === 'Next →')[0].props.disabled, true);
});
test('history controls open full reports, delete a report, and escape submitted text', () => {
  const entry = { ...report(1), message: '<img src=x onerror=alert(1)>' };
  const actions = [];
  const tree = pages.HistoryPage(historyProps({ history: [entry], total: 1, openReport: (item) => actions.push(item._id), deleteScan: (id) => actions.push('delete-' + id) }));
  const buttons = elements(tree, (node) => node.type === 'button');
  buttons.find((button) => button.props.children === 'View').props.onClick();
  buttons.find((button) => button.props.className === 'history-delete').props.onClick();
  assert.deepEqual(actions, ['report-1', 'delete-report-1']);
  const html = renderToStaticMarkup(tree);
  assert.ok(html.includes('&lt;img')); assert.ok(!html.includes('<img src=x'));
});
test('chat refresh merges out-of-order messages without duplicates', () => {
  const first = { _id: '001', body: 'First' };
  const second = { _id: '002', body: 'Second' };
  const third = { _id: '003', body: 'Third' };
  assert.deepEqual(chat.mergeChatMessages([second, first], [second, third]).map((message) => message.body), ['First', 'Second', 'Third']);
});
test('member chat and staff inbox render accessible, private conversation controls', () => {
  for (const role of ['user', 'staff', 'admin']) {
    const html = renderToStaticMarkup(React.createElement(chat.default, { user: { id: 'account-' + role, name: role, role } }));
    assert.ok(html.includes('role="log"')); assert.match(html, /maxlength="2000"/i);
    assert.ok(html.includes('Never share passwords, OTPs, or card numbers.'));
    assert.ok(html.includes(role === 'user' ? 'Chat with Staff' : 'Support inbox'));
  }
});
test('upper duplicate navigation is absent and fixed table geometry is defined', async () => {
  const appSource = await readFile(new URL('../../client/src/App.jsx', import.meta.url), 'utf8');
  assert.ok(!appSource.includes('<nav>')); assert.ok(appSource.includes('className="sidebar"'));
  const css = await readFile(new URL('../../client/src/member-workflow.css', import.meta.url), 'utf8');
  assert.match(css, /table-layout:fixed/); assert.match(css, /tbody tr\{height:76px\}/);
  assert.match(css, /prefers-reduced-motion/);
});

test('workspace pages omit visible introductory headers while retaining accessible headings and controls', async () => {
  const rendered = [
    renderToStaticMarkup(React.createElement(pages.MemberOverview, { scanTotal: 5, go: () => {} })),
    renderToStaticMarkup(React.createElement(pages.HistoryPage, historyProps())),
    ...['user', 'staff', 'admin'].map((role) => renderToStaticMarkup(React.createElement(chat.default, { user: { id: role, role } }))),
    renderToStaticMarkup(React.createElement(operations.StaffOverview, { data: {}, go: () => {} })),
    renderToStaticMarkup(React.createElement(operations.ContentManager, { run: () => Promise.resolve(null), onPublishedChange: () => {} })),
    renderToStaticMarkup(React.createElement(operations.MaintenancePage, { run: () => Promise.resolve(null), onChange: () => {} })),
  ];
  for (const html of rendered) {
    assert.ok(!html.includes('class="page-head"'));
    assert.ok(!html.includes('class="member-welcome"'));
    assert.match(html, /<h1 class="visually-hidden">/);
    assert.ok(!html.includes('A suspicious message?'));
  }
  assert.ok(rendered[0].includes('Start a scan'));
  assert.ok(rendered[1].includes('Submitted content'));
  const source = await readFile(new URL('../../client/src/App.jsx', import.meta.url), 'utf8');
  assert.ok(source.includes('function PageTitle({ title, action }) { return <><h1 className="visually-hidden">{title}</h1>{action}</>; }'));
});

function detectorProps(overrides = {}) {
  return { scanMode: 'text', setScanMode: () => {}, message: '', setMessage: () => {}, imageFile: null, setImageFile: () => {}, ocrProgress: 0, analyze: () => {}, analyzeImage: () => {}, analysis: null, clearAnalysis: () => {}, busy: false, go: () => {}, ...overrides };
}
test('detector keeps input and result cards with accessible message, link and image modes', () => {
  for (const mode of ['text', 'url', 'image']) {
    const html = renderToStaticMarkup(React.createElement(detector.default, detectorProps({ scanMode: mode })));
    assert.match(html, /class="detector-editor studio-card"/);
    assert.match(html, /detector-result-card studio-card/);
    assert.match(html, /aria-label="Choose content to scan"/);
    assert.match(html, /aria-pressed="true"/);
    assert.ok(!html.includes('class="page-head"'));
    if (mode === 'text') assert.match(html, /minlength="10" maxlength="5000"/i);
    if (mode === 'url') { assert.match(html, /type="url"/); assert.match(html, /We do not visit the website/); }
    if (mode === 'image') assert.match(html, /accept="image\/png,image\/jpeg,image\/webp"/);
  }
  const html = renderToStaticMarkup(React.createElement(detector.default, detectorProps({ analysis: { score: 78, level: 'High', explanation: 'Sensitive data requested.', flags: ['OTP', 'Urgency', 'Prize', 'Short link'], recommendation: 'Do not send your OTP.' } })));
  assert.match(html, /78/); assert.match(html, /High risk/); assert.match(html, /1 more signals/);
  assert.match(html, /Do not send your OTP/); assert.match(html, /A score is guidance, not proof of safety/);
});
test('recovery puts private and saved requests first, with collapsed guides and private replies', () => {
  const html = renderToStaticMarkup(React.createElement(recovery.default, { sendHelp: () => {}, busy: false, go: () => {}, mySupport: [{ _id: 'ticket', subject: 'Payment concern', message: 'Please review my payment.', status: 'in-progress', createdAt: '2026-10-07T03:00:00Z', replies: [{ _id: 'reply', byName: 'Support Staff', body: 'Contact your provider.', createdAt: '2026-10-07T04:00:00Z' }] }] }));
  assert.ok(html.indexOf('Private request') < html.indexOf('Your requests'));
  assert.ok(html.indexOf('Your requests') < html.indexOf('Quick recovery steps'));
  assert.ok(html.includes('Support Staff')); assert.ok(html.includes('In progress'));
  assert.equal((html.match(/class="recovery-guide"/g) || []).length, 3);
  assert.ok(!html.includes(' open=""'));
  assert.match(html, /name="subject"/); assert.match(html, /name="message"/);
});
test('profile adds identity and security cards while preserving the name update form', () => {
  const html = renderToStaticMarkup(React.createElement(profile.default, { user: { id: 'member', name: 'Alex Student', email: 'alex@example.com', emailVerified: true, createdAt: '2026-10-01T00:00:00Z', role: 'user' }, scanTotal: 11, saveProfile: () => {}, busy: false, go: () => {} }));
  assert.ok(html.includes('profile-cover')); assert.ok(html.includes('profile-initials">AS'));
  assert.match(html, /Email verified/); assert.match(html, /Saved reports/);
  assert.match(html, /name="name"/); assert.match(html, /readonly=""/);
  assert.match(html, /Security settings/); assert.match(html, /30 minutes/);
});
test('chat launcher is collapsed initially and opens an accessible popup for members and staff', () => {
  const user = { id: 'member', name: 'Alex', role: 'user' };
  const closed = renderToStaticMarkup(React.createElement(widget.default, { user, open: false, setOpen: () => {} }));
  assert.match(closed, /aria-label="Open support chat"/); assert.match(closed, /aria-expanded="false"/);
  assert.ok(!closed.includes('role="dialog"'));
  for (const role of ['user', 'staff']) {
    const html = renderToStaticMarkup(React.createElement(widget.default, { user: { ...user, role }, open: true, setOpen: () => {} }));
    assert.match(html, /role="dialog"/); assert.match(html, /aria-label="Minimize chat"/);
    assert.match(html, /aria-label="Attach images, videos, audio, or files"/);
    assert.match(html, /accept="\.png,\.jpg,\.jpeg,\.webp,\.gif,\.mp4,\.webm,\.mp3,\.wav,\.pdf,\.txt"/);
  }
});
test('chat renders private media URLs with controls, safe filenames and no autoplay', () => {
  for (const kind of ['image', 'video', 'audio', 'file']) {
    const html = renderToStaticMarkup(React.createElement(chat.ChatAttachmentView, { threadId: 'thread', attachment: { _id: 'file-id', name: '<script>bad</script>.png', kind, size: 2048 } }));
    assert.match(html, /\/chat\/threads\/thread\/attachments\/file-id/);
    assert.match(html, /download=1/); assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('autoplay'));
    if (['video', 'audio'].includes(kind)) { assert.match(html, /controls=""/); assert.match(html, /crossorigin="use-credentials"/i); }
  }
});
test('client file picker validates supported formats and per-type size limits', () => {
  assert.equal(media.describeChatFile({ name: 'proof.PNG', size: 1024 }).kind, 'image');
  assert.equal(media.describeChatFile({ name: 'clip.mp4', size: 1024 }).contentType, 'video/mp4');
  assert.throws(() => media.describeChatFile({ name: 'program.exe', size: 10 }));
  assert.throws(() => media.describeChatFile({ name: 'empty.pdf', size: 0 }));
  assert.throws(() => media.describeChatFile({ name: 'big.png', size: 5 * 1024 * 1024 + 1 }));
  assert.equal(media.formatFileSize(2048), '2 KB');
});
test('popup routing keeps the current page and isolates chat state across accounts', async () => {
  const source = await readFile(new URL('../../client/src/App.jsx', import.meta.url), 'utf8');
  assert.ok(source.includes("if (next === 'chat') { setChatOpen(true); return; }"));
  assert.ok(source.includes("key={user.id + ':' + user.role}"));
  assert.ok(!source.includes("if (page === 'chat')"));
  const css = await readFile(new URL('../../client/src/floating-chat.css', import.meta.url), 'utf8');
  assert.match(css, /position:fixed/); assert.match(css, /bottom:/); assert.match(css, /right:/);
  assert.match(css, /prefers-reduced-motion/);
  const studio = await readFile(new URL('../../client/src/studio.css', import.meta.url), 'utf8');
  assert.match(studio, /@media/); assert.match(studio, /minmax\(0,/);
});

const managerAccount = (index, role = 'user') => ({ _id: 'member-' + index, id: 'member-' + index, name: 'Member ' + index, email: 'member' + index + '@example.com', role, isActive: true, emailVerified: true, createdAt: '2026-10-07T03:00:00Z' });
test('management pagination clamps pages and keeps filtering safe and case-insensitive', () => {
  const items = Array.from({ length: 11 }, (_, index) => managerAccount(index));
  assert.equal(consoleUI.pageSlice(items, 1).rows.length, 10);
  assert.equal(consoleUI.pageSlice(items, 2).rows.length, 1);
  assert.equal(consoleUI.pageSlice(items.slice(0, 10), 2).page, 1);
  assert.deepEqual(consoleUI.pageSlice([], 99), { rows: [], page: 1, pages: 1 });
  assert.equal(consoleUI.textMatches('  MEMBER1  ', 'Member 1', 'member1@example.com'), true);
  assert.equal(consoleUI.textMatches('missing', 'Member', undefined), false);
});
test('Staff and Admin dashboards show role-appropriate tools, with no introductory headers', () => {
  const destinations = [];
  const staff = operations.StaffOverview({ data: { users: 12, contents: 8, openSupport: 2 }, go: (page) => destinations.push(page), refresh: () => {} });
  for (const node of elements(staff, (node) => node.type === consoleUI.ConsoleAction)) node.props.onClick();
  assert.deepEqual(destinations, ['adminUsers', 'contents', 'adminSupport', 'chat', 'profile', 'settings']);
  const staffHtml = renderToStaticMarkup(staff);
  assert.ok(!staffHtml.includes('Maintenance')); assert.ok(!staffHtml.includes('CyberShield'));
  const adminHtml = renderToStaticMarkup(React.createElement(management.AdminOverview, { data: { accounts: 15, staff: 3, verified: 12, reports: 22, openSupport: 2, latestAudit: [] }, go: () => {}, refresh: () => {} }));
  for (const html of [staffHtml, adminHtml]) { assert.match(html, /<h1 class="visually-hidden">/); assert.ok(!html.includes('class="page-head"')); assert.ok(!html.includes('Hello,')); }
  assert.match(adminHtml, /Report review/); assert.match(adminHtml, /Maintenance/); assert.match(adminHtml, /Audit log/);
});
test('management navigation groups links and preserves selection in account records and popup chat', () => {
  const calls = [];
  const entries = [['staffOverview', 'Staff Overview'], ['adminUsers', 'Manage Users'], ['contents', 'Manage Content'], ['chat', 'Member Chat'], ['adminSupport', 'Customer Support'], ['profile', 'My Profile'], ['settings', 'Security Settings']];
  const tree = consoleUI.ManagementSidebar({ entries, page: 'adminAccountDetails', chatOpen: false, go: (id) => calls.push(id), role: 'staff' });
  const buttons = elements(tree, (node) => node.type === 'button');
  assert.equal(buttons.length, entries.length);
  const selected = buttons.filter((button) => button.props['aria-current'] === 'page');
  assert.equal(selected.length, 1); assert.ok(renderToStaticMarkup(selected[0]).includes('Manage Users'));
  buttons.find((button) => renderToStaticMarkup(button).includes('Member Chat')).props.onClick();
  assert.deepEqual(calls, ['chat']);
  assert.ok(!renderToStaticMarkup(tree).includes('Maintenance'));
});
test('account management has ten stable row slots and self-protection while preserving CRUD actions', () => {
  const users = Array.from({ length: 11 }, (_, index) => managerAccount(index, index === 0 ? 'admin' : 'user'));
  const html = renderToStaticMarkup(React.createElement(management.UserManagement, { users, busy: false, currentUserId: users[0]._id, allowRoles: true, onChange: () => {}, onDetails: () => {}, onDelete: () => {}, refresh: () => {} }));
  assert.equal((html.match(/<tbody><tr|<\/tr><tr/g) || []).length, 10);
  assert.ok(!html.includes('member10@example.com'));
  assert.match(html, /aria-label="Edit Member 1"/); assert.match(html, /aria-label="Open record for Member 1"/);
  assert.match(html, /disabled="" aria-label="Suspend Member 0"/);
  assert.match(html, /disabled="" aria-label="Delete Member 0"/);
  const empty = renderToStaticMarkup(React.createElement(management.UserManagement, { users: [], busy: false, allowRoles: false, refresh: () => {} }));
  assert.equal((empty.match(/class="console-placeholder"/g) || []).length, 10);
  assert.ok(!empty.includes('Filter account role'));
});
test('account editor retains validated name/email inputs and only Admin can edit roles', () => {
  for (const allowRoles of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(management.AccountEditor, { member: managerAccount(1), allowRoles, busy: false, onChange: () => {}, onClose: () => {} }));
    assert.match(html, /name="name"/); assert.match(html, /minlength="2" maxlength="80"/i);
    assert.match(html, /name="email" type="email"/); assert.equal(html.includes('name="role"'), allowRoles);
    assert.match(html, /Save changes/);
  }
});
test('report review has twenty stable row slots, risk filters and working review callbacks', () => {
  const opened = []; const changes = [];
  const tree = management.AdminReports({ reports: [{ ...report(1), user: { name: 'Member One' } }], total: 21, page: 1, pages: 2, level: 'All', setPage: (page) => changes.push(page), setLevel: (level) => changes.push(level), openReport: (item) => opened.push(item._id) });
  const buttons = elements(tree, (node) => node.type === 'button');
  buttons.find((button) => button.props.children === 'Safe').props.onClick();
  const tableRows = elements(tree, (node) => node.type === consoleUI.FixedRows)[0];
  const renderedRow = tableRows.props.render(tableRows.props.rows[0]);
  elements(renderedRow, (node) => node.props.className === 'console-record-title')[0].props.onClick();
  assert.deepEqual(changes, ['Safe', 1]); assert.deepEqual(opened, ['report-1']);
  const html = renderToStaticMarkup(tree);
  assert.equal((html.match(/class="console-placeholder"/g) || []).length, 19);
  assert.match(html, /Member One/); assert.match(html, /0?1–20 of 21/);
});
test('support inbox shows one selected private request and one reply form, instead of many forms', () => {
  const items = Array.from({ length: 11 }, (_, index) => ({ _id: 'request-' + index, subject: 'Concern ' + index, senderName: 'Member ' + index, senderEmail: 'member' + index + '@example.com', status: 'open', message: 'Private request text ' + index, createdAt: '2026-10-07T03:00:00Z', replies: index ? [] : [{ _id: 'reply', byName: 'Staff One', body: 'Contact your bank first.', createdAt: '2026-10-07T04:00:00Z' }] }));
  const html = renderToStaticMarkup(React.createElement(management.AdminSupport, { items, busy: false, updateStatus: () => {}, replyToHelp: () => {}, refresh: () => {} }));
  assert.equal((html.match(/name="body"/g) || []).length, 1);
  assert.match(html, /Private request text 0/); assert.ok(!html.includes('Private request text 1'));
  assert.match(html, /Staff One/); assert.match(html, /Contact your bank first/);
  assert.ok(!html.includes('Concern 10')); assert.match(html, /Page 1 of 2/);
  assert.match(html, /minlength="10" maxlength="4000"/i);
});
test('audit and account records paginate and keep security/audit tabs exclusive to Admin', () => {
  const logs = Array.from({ length: 21 }, (_, index) => ({ _id: 'log-' + index, action: 'user.action_' + index, actorName: 'Member', actorRole: 'user', createdAt: '2026-10-07T03:00:00Z' }));
  const html = renderToStaticMarkup(React.createElement(management.AuditLogPage, { logs, refresh: () => {} }));
  assert.match(html, /Page 1 of 2/); assert.ok(!html.includes('action_20'));
  const details = { user: managerAccount(0), analyses: [report(1)], support: [], audit: logs, events: [] };
  for (const admin of [false, true]) {
    const output = renderToStaticMarkup(React.createElement(management.AccountDetails, { details, admin, back: () => {}, openReport: () => {} }));
    assert.equal(output.includes('>Security<span>'), admin); assert.equal(output.includes('>Audit<span>'), admin);
    assert.match(output, /member0@example.com/); assert.match(output, /Suspicious message 1/);
  }
});
test('management layouts contain long lists and stack on smaller screens without affecting member styling', async () => {
  const css = await readFile(new URL('../../client/src/management-console.css', import.meta.url), 'utf8');
  assert.match(css, /\.management-shell \.sidebar\{position:sticky/);
  assert.match(css, /height:calc\(100dvh - 76px\)/); assert.match(css, /table-layout:fixed/);
  assert.match(css, /\.console-table-scroll\{height:520px/); assert.match(css, /@media\(max-width:840px\)/);
  assert.match(css, /overflow-x:auto/); assert.match(css, /prefers-reduced-motion/);
  const source = await readFile(new URL('../../client/src/App.jsx', import.meta.url), 'utf8');
  assert.ok(source.includes("(isManager ? ' management-shell' : '')"));
  assert.ok(source.includes('<ManagementSidebar entries={visibleNav}'));
  assert.ok(source.includes('currentUserId={user.id}')); assert.ok(source.includes('admin={isAdmin}'));
});
