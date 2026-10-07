import test, { before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import app from '../src/app.js';
import User from '../src/models/User.js';
import SiteSettings from '../src/models/SiteSettings.js';
import AuditLog from '../src/models/AuditLog.js';
import ChatThread from '../src/models/ChatThread.js';
import ChatMessage from '../src/models/ChatMessage.js';
import MessageAnalysis from '../src/models/MessageAnalysis.js';
import SecurityEvent from '../src/models/SecurityEvent.js';
import SupportMessage from '../src/models/SupportMessage.js';
import { chatMediaStore } from '../src/services/chatMediaStore.js';
import { COOKIE_NAME, signSession } from '../src/utils/auth.js';

let server, base, accounts, threads, messages, reports, audits, sequence, maintenance, files, fileSequence;
const ids = { user: '710000000000000000000001', other: '710000000000000000000002', staff: '710000000000000000000003', admin: '710000000000000000000004', guest: '710000000000000000000005' };
const firstThread = '720000000000000000000001';
const secondThread = '720000000000000000000002';
const equal = (a, b) => String(a) === String(b);
function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) => {
    const actual = row[key];
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('$in' in value) return value.$in.some((entry) => equal(entry, actual));
      if ('$ne' in value) return !equal(actual, value.$ne);
      if ('$lt' in value) return actual < value.$lt;
      if ('$lte' in value) return actual <= value.$lte;
    }
    return equal(actual, value);
  });
}
function query(value) {
  let rows = Array.isArray(value) ? [...value] : value;
  let offset = 0, limit = Infinity, populateUser = false;
  const read = () => {
    const populate = (row) => !row ? null : populateUser ? { ...row, user: accounts.find((account) => equal(account._id, row.user)) || null } : row;
    return Array.isArray(rows) ? rows.slice(offset, offset + limit).map(populate) : populate(rows);
  };
  const result = {
    select: () => result,
    populate: () => { populateUser = true; return result; },
    sort: (fields) => { if (Array.isArray(rows)) rows.sort((a, b) => { for (const [field, direction] of Object.entries(fields)) { if (a[field] < b[field]) return -direction; if (a[field] > b[field]) return direction; } return 0; }); return result; },
    skip: (count) => { offset = count; return result; },
    limit: (count) => { limit = count; return result; },
    lean: async () => read(),
    then: (resolve, reject) => Promise.resolve(read()).then(resolve, reject),
  };
  return result;
}

before(async () => {
  process.env.JWT_SECRET = 'isolated-chat-tests-secret-not-a-real-account';
  process.env.SESSION_TTL_HOURS = '0.5';
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = 'http://127.0.0.1:' + server.address().port + '/api';
});
beforeEach(() => {
  mock.restoreAll(); sequence = 0; fileSequence = 0; maintenance = false; audits = []; files = [];
  accounts = Object.entries(ids).map(([key, _id]) => ({ _id, name: key + ' name', email: key + '@example.com', role: ['staff', 'admin'].includes(key) ? key : 'user', isGuest: key === 'guest', isActive: true }));
  threads = [{ _id: firstThread, user: ids.user, lastMessageAt: new Date(0), lastMessagePreview: '' }, { _id: secondThread, user: ids.other, lastMessageAt: new Date(0), lastMessagePreview: '' }];
  messages = []; reports = [];
  mock.method(SiteSettings, 'findOne', () => query({ maintenanceEnabled: maintenance, maintenanceMessage: 'Maintenance in progress.' }));
  mock.method(User, 'findOne', (filter) => query(accounts.find((account) => matches(account, filter)) || null));
  mock.method(User, 'distinct', async (_field, filter) => accounts.filter((account) => matches(account, filter)).map((account) => account._id));
  mock.method(User, 'find', (filter) => query(accounts.filter((account) => matches(account, filter))));
  mock.method(User, 'exists', async (filter) => accounts.find((account) => matches(account, filter)) ? { _id: ids.admin } : null);
  mock.method(User, 'findOneAndDelete', async (filter) => { const index = accounts.findIndex((account) => matches(account, filter)); return index < 0 ? null : accounts.splice(index, 1)[0]; });
  mock.method(ChatThread, 'countDocuments', async (filter) => threads.filter((thread) => matches(thread, filter)).length);
  mock.method(ChatThread, 'find', (filter) => query(threads.filter((thread) => matches(thread, filter))));
  mock.method(ChatThread, 'findOne', (filter) => query(threads.find((thread) => matches(thread, filter)) || null));
  mock.method(ChatThread, 'findOneAndUpdate', async (filter, update) => {
    let thread = threads.find((item) => matches(item, filter));
    if (!thread) { thread = { _id: '720000000000000000000099', ...update.$setOnInsert, lastMessageAt: new Date(0) }; threads.push(thread); }
    return thread;
  });
  mock.method(ChatThread, 'updateOne', async (filter, update) => { const thread = threads.find((item) => matches(item, filter)); if (thread) Object.assign(thread, update.$set); return { modifiedCount: thread ? 1 : 0 }; });
  mock.method(ChatThread, 'deleteMany', async (filter) => { threads = threads.filter((thread) => !matches(thread, filter)); return {}; });
  mock.method(chatMediaStore, 'save', async (buffer, file, thread, sender) => {
    const entry = { _id: (0x770000000000000000000000n + BigInt(++fileSequence)).toString(16), filename: file.name, length: buffer.length, buffer, metadata: { thread: String(thread), sender: String(sender), state: 'pending', contentType: file.contentType, kind: file.kind } };
    files.push(entry); return { _id: entry._id, ...file };
  });
  mock.method(chatMediaStore, 'claim', async (ids, thread, sender) => {
    const selected = ids.map((id) => files.find((file) => equal(file._id, id) && equal(file.metadata.thread, thread) && equal(file.metadata.sender, sender) && file.metadata.state === 'pending'));
    if (selected.some((file) => !file)) throw Object.assign(new Error('Attachment is unavailable.'), { status: 400 });
    selected.forEach((file) => { file.metadata.state = 'reserved'; });
    return selected.map((file) => ({ _id: file._id, name: file.filename, size: file.length, contentType: file.metadata.contentType, kind: file.metadata.kind }));
  });
  mock.method(chatMediaStore, 'publish', async (ids) => { files.filter((file) => ids.includes(file._id)).forEach((file) => { file.metadata.state = 'published'; }); });
  mock.method(chatMediaStore, 'release', async (ids) => { files.filter((file) => ids.includes(file._id) && file.metadata.state === 'reserved').forEach((file) => { file.metadata.state = 'pending'; }); });
  mock.method(chatMediaStore, 'get', async (id, thread) => files.find((file) => equal(file._id, id) && equal(file.metadata.thread, thread) && ['reserved', 'published'].includes(file.metadata.state)) || null);
  mock.method(chatMediaStore, 'open', (id, range) => { const file = files.find((entry) => equal(entry._id, id)); return Readable.from(range ? file.buffer.subarray(range.start, range.end + 1) : file.buffer); });
  mock.method(chatMediaStore, 'removePending', async (id, thread, sender) => {
    const index = files.findIndex((file) => equal(file._id, id) && equal(file.metadata.thread, thread) && equal(file.metadata.sender, sender) && file.metadata.state === 'pending');
    if (index < 0) return false; files.splice(index, 1); return true;
  });
  mock.method(chatMediaStore, 'deleteForThreads', async (ids) => { files = files.filter((file) => !ids.some((id) => equal(id, file.metadata.thread))); });
  mock.method(ChatMessage, 'find', (filter) => query(messages.filter((message) => matches(message, filter))));
  mock.method(ChatMessage, 'exists', async (filter) => messages.find((message) => equal(message.thread, filter.thread) && message.attachments?.some((file) => equal(file._id, filter['attachments._id']))) ? { _id: 'sent-message' } : null);
  mock.method(ChatMessage, 'create', async (entry) => { const message = { ...entry, _id: (0x730000000000000000000000n + BigInt(++sequence)).toString(16), createdAt: new Date() }; messages.push(message); return message; });
  mock.method(ChatMessage, 'deleteMany', async (filter) => { messages = messages.filter((message) => !matches(message, filter)); return {}; });
  mock.method(MessageAnalysis, 'find', (filter) => query(reports.filter((report) => matches(report, filter))));
  mock.method(MessageAnalysis, 'countDocuments', async (filter) => reports.filter((report) => matches(report, filter)).length);
  mock.method(MessageAnalysis, 'deleteMany', async () => ({}));
  mock.method(SecurityEvent, 'deleteMany', async () => ({}));
  mock.method(SupportMessage, 'deleteMany', async () => ({}));
  mock.method(AuditLog, 'create', async (entry) => { audits.push(entry); return entry; });
});
after(async () => { mock.restoreAll(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
async function request(path, role, method = 'GET', body, ip = '127.0.0.1') {
  const account = accounts.find((entry) => entry._id === ids[role]);
  const response = await fetch(base + path, { method, headers: { 'X-Forwarded-For': ip, ...(account ? { Cookie: COOKIE_NAME + '=' + signSession(account) } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}
const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
async function upload(thread, role, ip, buffer = png, mime = 'image/png', name = 'evidence.png') {
  const account = accounts.find((entry) => entry._id === ids[role]);
  const response = await fetch(base + '/chat/threads/' + thread + '/attachments', { method: 'POST', headers: { Cookie: COOKIE_NAME + '=' + signSession(account), 'X-Forwarded-For': ip, 'Content-Type': mime, 'X-File-Name': encodeURIComponent(name) }, body: buffer });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}
async function download(thread, fileId, role, headers = {}, suffix = '') {
  const account = accounts.find((entry) => entry._id === ids[role]);
  return fetch(base + '/chat/threads/' + thread + '/attachments/' + fileId + suffix, { headers: { Cookie: COOKIE_NAME + '=' + signSession(account), ...headers } });
}

test('chat requires authentication and rejects historical guest accounts', async () => {
  assert.equal((await request('/chat/threads')).status, 401);
  assert.equal((await request('/chat/threads', 'guest')).status, 401);
});
test('members see only their own conversation while staff/admin have a support inbox', async () => {
  const member = await request('/chat/threads', 'user');
  assert.equal(member.status, 200); assert.equal(member.body.threads.length, 1);
  assert.equal(member.body.threads[0]._id, firstThread);
  for (const role of ['staff', 'admin']) {
    const inbox = await request('/chat/threads', role);
    assert.equal(inbox.status, 200); assert.equal(inbox.body.threads.length, 2);
  }
});
test('starting a conversation is idempotent and cannot impersonate another member', async () => {
  for (let index = 0; index < 2; index++) {
    const response = await request('/chat/threads', 'user', 'POST', { user: ids.other });
    assert.equal(response.status, 200); assert.equal(response.body.thread.user, ids.user);
  }
  assert.equal(threads.length, 2);
  assert.equal((await request('/chat/threads', 'staff', 'POST', {})).status, 403);
});
test('a member cannot read or send messages in another member conversation', async () => {
  assert.equal((await request('/chat/threads/' + secondThread + '/messages', 'user')).status, 404);
  assert.equal((await request('/chat/threads/' + secondThread + '/messages', 'user', 'POST', { body: 'Unauthorized message' }, '127.0.0.2')).status, 404);
  assert.equal(messages.length, 0);
});
test('member and staff can exchange saved messages without trusting client identity fields', async () => {
  const member = await request('/chat/threads/' + firstThread + '/messages', 'user', 'POST', { body: '  Is this message suspicious?  ', sender: ids.admin, senderRole: 'admin' }, '127.0.0.3');
  assert.equal(member.status, 201); assert.equal(member.body.message.sender, ids.user);
  assert.equal(member.body.message.senderRole, 'user'); assert.equal(member.body.message.body, 'Is this message suspicious?');
  const staff = await request('/chat/threads/' + firstThread + '/messages', 'staff', 'POST', { body: 'Open the detector first and review its signals.' }, '127.0.0.3');
  assert.equal(staff.status, 201); assert.equal(staff.body.message.senderRole, 'staff');
  const saved = await request('/chat/threads/' + firstThread + '/messages', 'user');
  assert.deepEqual(saved.body.messages.map((message) => message.senderRole), ['user', 'staff']);
  assert.equal(threads[0].lastMessagePreview, staff.body.message.body);
  assert.ok(audits.every((entry) => entry.action === 'chat.message_sent' && !entry.details));
});
test('chat validates blank, oversized, object messages and malformed IDs/cursors', async () => {
  for (const body of ['', '   ', 'x'.repeat(2001), { text: 'not plain text' }]) {
    assert.equal((await request('/chat/threads/' + firstThread + '/messages', 'user', 'POST', { body }, '127.0.0.4')).status, 400);
  }
  assert.equal((await request('/chat/threads/not-an-id/messages', 'user')).status, 404);
  assert.equal((await request('/chat/threads/' + firstThread + '/messages?before=invalid', 'user')).status, 400);
  assert.equal(messages.length, 0);
});
test('older chat messages are paged without duplicates or another member messages', async () => {
  for (let index = 1; index <= 55; index++) messages.push({ _id: (0x730000000000000000000000n + BigInt(index)).toString(16), thread: firstThread, body: 'Message ' + index });
  messages.push({ _id: '740000000000000000000001', thread: secondThread, body: 'Private other message' });
  const latest = await request('/chat/threads/' + firstThread + '/messages', 'user');
  assert.equal(latest.body.messages.length, 50); assert.equal(latest.body.hasOlder, true);
  assert.equal(latest.body.messages[0].body, 'Message 6');
  const earlier = await request('/chat/threads/' + firstThread + '/messages?before=' + latest.body.messages[0]._id, 'user');
  assert.equal(earlier.body.messages.length, 5); assert.equal(earlier.body.hasOlder, false);
  assert.equal(earlier.body.messages[0].body, 'Message 1');
});
test('message flooding is rate limited', async () => {
  for (let index = 0; index < 15; index++) assert.equal((await request('/chat/threads/' + firstThread + '/messages', 'user', 'POST', { body: 'Message ' + index }, '127.0.0.5')).status, 201);
  assert.equal((await request('/chat/threads/' + firstThread + '/messages', 'user', 'POST', { body: 'Too many' }, '127.0.0.5')).status, 429);
});
test('maintenance blocks member and staff chat access but retains admin oversight', async () => {
  maintenance = true;
  assert.equal((await request('/chat/threads', 'user')).status, 503);
  assert.equal((await request('/chat/threads', 'staff')).status, 503);
  assert.equal((await request('/chat/threads', 'admin')).status, 200);
});
test('deleting a member removes their conversation and messages without affecting others', async () => {
  messages = [{ _id: '730000000000000000000001', thread: firstThread }, { _id: '730000000000000000000002', thread: secondThread }];
  await upload(firstThread, 'user', '127.0.0.20');
  await upload(secondThread, 'other', '127.0.0.20');
  assert.equal((await request('/admin/users/' + ids.user, 'admin', 'DELETE')).status, 204);
  assert.deepEqual(threads.map((thread) => thread._id), [secondThread]);
  assert.deepEqual(messages.map((message) => message.thread), [secondThread]);
  assert.deepEqual(files.map((file) => file.metadata.thread), [secondThread]);
});

test('support directory exposes names and roles, not email addresses or account secrets', async () => {
  const response = await request('/chat/staff', 'user');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.staff.map((person) => person.role).sort(), ['admin', 'staff']);
  assert.ok(response.body.staff.every((person) => Object.keys(person).sort().join(',') === 'id,name,role'));
});
test('members and staff can send private attachments, including attachment-only messages', async () => {
  for (const role of ['user', 'staff']) {
    const uploaded = await upload(firstThread, role, '127.0.0.21');
    assert.equal(uploaded.status, 201); assert.equal(uploaded.body.attachment.kind, 'image');
    const fileId = uploaded.body.attachment._id;
    const pending = await download(firstThread, fileId, role);
    assert.equal(pending.status, 404); await pending.arrayBuffer();
    const sent = await request('/chat/threads/' + firstThread + '/messages', role, 'POST', { attachments: [fileId] }, '127.0.0.21');
    assert.equal(sent.status, 201); assert.equal(sent.body.message.body, '');
    assert.equal(sent.body.message.attachments[0]._id, fileId);
    const saved = await download(firstThread, fileId, role === 'user' ? 'staff' : 'user');
    assert.equal(saved.status, 200); assert.equal(saved.headers.get('cache-control'), 'no-store');
    assert.equal(saved.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(saved.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await saved.arrayBuffer()), png);
  }
});
test('another member cannot upload, read, or claim files from a private conversation', async () => {
  const uploaded = await upload(firstThread, 'user', '127.0.0.22');
  const fileId = uploaded.body.attachment._id;
  assert.equal((await upload(firstThread, 'other', '127.0.0.22')).status, 404);
  assert.equal((await request('/chat/threads/' + firstThread + '/messages', 'staff', 'POST', { attachments: [fileId] }, '127.0.0.22')).status, 400);
  assert.equal((await request('/chat/threads/' + secondThread + '/messages', 'other', 'POST', { attachments: [fileId] }, '127.0.0.22')).status, 400);
  assert.equal((await request('/chat/threads/' + firstThread + '/messages', 'user', 'POST', { attachments: [fileId] }, '127.0.0.22')).status, 201);
  const denied = await download(firstThread, fileId, 'other');
  assert.equal(denied.status, 404); await denied.arrayBuffer();
});
test('video streaming supports byte ranges and rejects invalid ranges', async () => {
  const video = Buffer.from('000000186674797069736f6d0000020069736f6d69736f32', 'hex');
  const uploaded = await upload(firstThread, 'user', '127.0.0.23', video, 'video/mp4', 'clip.mp4');
  assert.equal(uploaded.status, 201);
  const fileId = uploaded.body.attachment._id;
  assert.equal((await request('/chat/threads/' + firstThread + '/messages', 'user', 'POST', { body: 'Here is the clip', attachments: [fileId] }, '127.0.0.23')).status, 201);
  const partial = await download(firstThread, fileId, 'staff', { Range: 'bytes=4-11' });
  assert.equal(partial.status, 206); assert.equal(partial.headers.get('content-range'), 'bytes 4-11/' + video.length);
  assert.deepEqual(Buffer.from(await partial.arrayBuffer()), video.subarray(4, 12));
  const invalid = await download(firstThread, fileId, 'user', { Range: 'bytes=999-' });
  assert.equal(invalid.status, 416); await invalid.arrayBuffer();
});
test('uploads validate content signatures, extensions, empty files and supported types', async () => {
  const checks = [
    [Buffer.from('<script>bad()</script>'), 'image/png', 'fake.png', 415],
    [png, 'image/png', 'fake.exe', 415],
    [Buffer.alloc(0), 'image/png', 'empty.png', 400],
    [Buffer.from('html'), 'text/html', 'page.html', 415],
  ];
  for (const [bytes, mime, name, expected] of checks) assert.equal((await upload(firstThread, 'user', '127.0.0.24', bytes, mime, name)).status, expected);
  assert.equal(files.length, 0);
});
test('only the uploader can remove an unsent file; sent files remain in the conversation', async () => {
  const uploaded = await upload(firstThread, 'user', '127.0.0.25');
  const fileId = uploaded.body.attachment._id;
  const path = '/chat/threads/' + firstThread + '/attachments/' + fileId;
  assert.equal((await request(path, 'staff', 'DELETE')).status, 404);
  assert.equal((await request(path, 'user', 'DELETE')).status, 204);
  const second = await upload(firstThread, 'user', '127.0.0.25');
  assert.equal((await request('/chat/threads/' + firstThread + '/messages', 'user', 'POST', { attachments: [second.body.attachment._id] }, '127.0.0.25')).status, 201);
  assert.equal((await request('/chat/threads/' + firstThread + '/attachments/' + second.body.attachment._id, 'user', 'DELETE')).status, 404);
});
test('attachments are capped at three, cannot be duplicated, and uploads are rate limited', async () => {
  for (const attachments of [[ids.user, ids.user], [ids.user, ids.other, ids.staff, ids.admin], ['invalid'], 'not-an-array']) {
    assert.equal((await request('/chat/threads/' + firstThread + '/messages', 'user', 'POST', { attachments }, '127.0.0.26')).status, 400);
  }
  for (let index = 0; index < 6; index++) assert.equal((await upload(firstThread, 'user', '127.0.0.27')).status, 201);
  assert.equal((await upload(firstThread, 'user', '127.0.0.27')).status, 429);
});
test('files are released for retry when a message cannot be saved', async () => {
  const uploaded = await upload(firstThread, 'user', '127.0.0.28');
  mock.method(ChatMessage, 'create', async () => { throw new Error('Simulated persistence failure'); });
  assert.equal((await request('/chat/threads/' + firstThread + '/messages', 'user', 'POST', { attachments: [uploaded.body.attachment._id] }, '127.0.0.28')).status, 500);
  assert.equal(files[0].metadata.state, 'pending');
});
test('a saved message still succeeds if its noncritical inbox preview update fails', async () => {
  mock.method(ChatThread, 'updateOne', async () => { throw new Error('Simulated preview failure'); });
  const response = await request('/chat/threads/' + firstThread + '/messages', 'user', 'POST', { body: 'The message is still saved.' }, '127.0.0.29');
  assert.equal(response.status, 201); assert.equal(messages.length, 1);
});
function seedReports(count) {
  for (let index = 1; index <= count; index++) reports.push({ _id: (0x750000000000000000000000n + BigInt(index)).toString(16), user: ids.user, message: 'Report ' + index, level: index % 2 ? 'High' : 'Safe', createdAt: new Date(index * 1000) });
  reports.push({ _id: '760000000000000000000001', user: ids.other, message: 'Other member report', level: 'High', createdAt: new Date() });
}
test('history shows ten reports and creates page two for the eleventh report', async () => {
  seedReports(11);
  const first = await request('/scam/history?page=1', 'user');
  const second = await request('/scam/history?page=2', 'user');
  assert.equal(first.body.total, 11); assert.equal(first.body.pages, 2); assert.equal(first.body.analyses.length, 10);
  assert.equal(second.body.analyses.length, 1); assert.equal(second.body.analyses[0].message, 'Report 1');
  assert.equal(new Set([...first.body.analyses, ...second.body.analyses].map((report) => report._id)).size, 11);
});
test('history filters and clamps obsolete pages after the last row is deleted', async () => {
  seedReports(11);
  const high = await request('/scam/history?level=High&page=1', 'user');
  assert.equal(high.body.total, 6); assert.ok(high.body.analyses.every((report) => report.level === 'High'));
  reports = reports.filter((report) => report.message !== 'Report 1');
  const clamped = await request('/scam/history?page=2', 'user');
  assert.equal(clamped.body.page, 1); assert.equal(clamped.body.pages, 1); assert.equal(clamped.body.analyses.length, 10);
  reports = [];
  const empty = await request('/scam/history?page=99', 'user');
  assert.equal(empty.body.page, 1); assert.equal(empty.body.pages, 1); assert.equal(empty.body.total, 0);
});
