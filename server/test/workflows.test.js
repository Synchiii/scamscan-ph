import test, { before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import User from '../src/models/User.js';
import SiteSettings from '../src/models/SiteSettings.js';
import Content from '../src/models/Content.js';
import AuditLog from '../src/models/AuditLog.js';
import SupportMessage from '../src/models/SupportMessage.js';
import { COOKIE_NAME, signSession, setSessionCookie, verifySession } from '../src/utils/auth.js';

let server, base, accounts, settings, contents, tickets;
const ids = { user: '100000000000000000000001', staff: '100000000000000000000002', admin: '100000000000000000000003', legacy: '100000000000000000000004' };
const passwordHash = bcrypt.hashSync('Study123', 4);
const query = (value) => {
  const result = { select: () => result, sort: () => result, limit: () => result, skip: () => result, lean: async () => value, then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) };
  return result;
};
const matchAccount = (filter) => accounts.find((account) => (!filter._id || String(account._id) === String(filter._id)) && (!filter.email || account.email === filter.email) && (!filter.role || account.role === filter.role) && (filter.isActive === undefined || account.isActive === filter.isActive) && !(filter.isGuest && account.isGuest));
before(async () => {
  process.env.JWT_SECRET = 'isolated-test-session-secret-without-production-data';
  process.env.SESSION_TTL_HOURS = '0.5';
  process.env.BREVO_API_KEY = '';
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = 'http://127.0.0.1:' + server.address().port + '/api';
});
beforeEach(() => {
  mock.restoreAll();
  accounts = Object.entries(ids).filter(([role]) => ['user', 'staff', 'admin', 'legacy'].includes(role)).map(([role, _id]) => ({ _id, name: role, email: role + '@example.com', role: role === 'legacy' ? 'user' : role, isGuest: role === 'legacy', passwordHash, emailVerified: true, isActive: true, preferences: {}, save: async function () { return this; } }));
  settings = { key: 'site', maintenanceEnabled: false, maintenanceMessage: 'Scheduled maintenance. Please check back shortly.' };
  contents = []; tickets = [{ _id: '400000000000000000000001', from: ids.user, status: 'open', replies: [], senderName: 'Customer', senderEmail: 'user@example.com', subject: 'Need help', save: async function () { return this; } }];
  mock.method(SiteSettings, 'findOne', () => query(settings));
  mock.method(SiteSettings, 'findOneAndUpdate', async (_filter, update) => { Object.assign(settings, update); return settings; });
  mock.method(User, 'findOne', (filter) => query(matchAccount(filter) || null));
  mock.method(User, 'exists', (filter) => Promise.resolve(matchAccount(filter) ? { _id: matchAccount(filter)._id } : null));
  mock.method(User, 'find', (filter) => query(accounts.filter((account) => (!filter.role || account.role === filter.role) && !(filter.isGuest && account.isGuest))));
  mock.method(User, 'countDocuments', async () => accounts.filter((account) => account.role === 'user' && !account.isGuest).length);
  mock.method(Content, 'countDocuments', async () => contents.length);
  mock.method(SupportMessage, 'countDocuments', async () => tickets.filter((ticket) => ticket.status !== 'resolved').length);
  mock.method(AuditLog, 'create', async (entry) => entry);
  mock.method(Content, 'find', (filter = {}) => query(contents.filter((item) => !filter.status || item.status === filter.status)));
  mock.method(Content, 'create', async (entry) => { const content = { ...entry, _id: '500000000000000000000001' }; contents.push(content); return content; });
  mock.method(Content, 'findByIdAndUpdate', async (id, update) => { const content = contents.find((item) => item._id === id); if (content) Object.assign(content, update); return content || null; });
  mock.method(Content, 'findByIdAndDelete', async (id) => { const index = contents.findIndex((item) => item._id === id); return index < 0 ? null : contents.splice(index, 1)[0]; });
  mock.method(SupportMessage, 'findOneAndUpdate', async (filter, update) => { const ticket = tickets.find((entry) => entry._id === filter._id && (!filter.from || filter.from.$in.includes(entry.from))); if (!ticket) return null; Object.assign(ticket, update); return ticket; });
  mock.method(SupportMessage, 'findOne', async (filter) => tickets.find((entry) => entry._id === filter._id && (!filter.from || filter.from.$in.includes(entry.from))) || null);
});
after(async () => { mock.restoreAll(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
async function request(path, role, method = 'GET', body) {
  const account = accounts.find((entry) => entry._id === ids[role]);
  const response = await fetch(base + path, { method, headers: { ...(account ? { Cookie: COOKIE_NAME + '=' + signSession(account) } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json().catch(() => ({})), cookie: response.headers.get('set-cookie') };
}

test('guest endpoint is removed and historical guest sessions cannot authenticate', async () => {
  assert.equal((await request('/auth/guest', null, 'POST')).status, 404);
  assert.equal((await request('/auth/me', 'legacy')).status, 401);
});
test('regular users cannot open staff or admin management APIs', async () => {
  for (const path of ['/admin/users', '/management/content', '/admin/maintenance']) assert.equal((await request(path, 'user')).status, 403);
});
test('staff can manage members but cannot assign roles or modify administrators', async () => {
  const listing = await request('/admin/users', 'staff');
  assert.equal(listing.status, 200);
  assert.deepEqual(listing.body.users.map((account) => account.role), ['user']);
  assert.equal((await request('/admin/users/' + ids.admin, 'staff', 'PATCH', { name: 'Changed admin' })).status, 404);
  assert.equal((await request('/admin/users/' + ids.user, 'staff', 'PATCH', { role: 'admin' })).status, 403);
  const update = await request('/admin/users/' + ids.user, 'staff', 'PATCH', { name: 'Updated member', isActive: false });
  assert.equal(update.status, 200);
  assert.equal(update.body.user.name, 'Updated member');
  assert.equal(update.body.user.isActive, false);
});
test('admin can promote a member to staff but cannot remove their own admin access', async () => {
  assert.equal((await request('/admin/users/' + ids.user, 'admin', 'PATCH', { role: 'staff' })).body.user.role, 'staff');
  assert.equal((await request('/admin/users/' + ids.admin, 'admin', 'PATCH', { role: 'staff' })).status, 400);
});
test('staff cannot access maintenance, audit, report review, or CyberShield', async () => {
  for (const path of ['/admin/maintenance', '/admin/audit-logs', '/admin/reports', '/threats/dashboard']) assert.equal((await request(path, 'staff')).status, 403);
});
test('maintenance persists, blocks existing user/staff sessions and registration, and permits admin recovery', async () => {
  const update = await request('/admin/maintenance', 'admin', 'PATCH', { maintenanceEnabled: true, maintenanceMessage: 'Scheduled maintenance. Please check back shortly.' });
  assert.equal(update.status, 200);
  assert.equal((await request('/site/status')).body.maintenanceEnabled, true);
  for (const role of ['user', 'staff']) {
    const response = await request('/auth/me', role);
    assert.equal(response.status, 503);
    assert.equal(response.body.code, 'MAINTENANCE_MODE');
    assert.equal((await request('/auth/login', null, 'POST', { email: role + '@example.com', password: 'Study123' })).status, 503);
  }
  assert.equal((await request('/auth/register', null, 'POST', {})).status, 503);
  assert.equal((await request('/auth/me', 'admin')).status, 200);
  assert.equal((await request('/auth/login', null, 'POST', { email: 'admin@example.com', password: 'Study123' })).status, 200);
  assert.equal((await request('/admin/maintenance', 'admin', 'PATCH', { maintenanceEnabled: false, maintenanceMessage: settings.maintenanceMessage })).status, 200);
  assert.equal((await request('/auth/me', 'staff')).status, 200);
});
test('staff content publication is visible publicly while drafts remain private', async () => {
  const body = { title: 'Safety guidance', body: 'Never disclose one-time passwords to callers.', category: 'guide', status: 'draft' };
  assert.equal((await request('/management/content', 'staff', 'POST', body)).status, 201);
  assert.equal((await request('/site/content')).body.contents.length, 0);
  assert.equal((await request('/management/content', 'staff', 'POST', { ...body, status: 'published' })).status, 201);
  assert.equal((await request('/site/content')).body.contents.length, 1);
  assert.equal((await request('/management/content', 'staff', 'POST', { ...body, body: 'short' })).status, 400);
});
test('staff can resolve a customer support request and update their profile', async () => {
  const response = await request('/admin/support/' + tickets[0]._id, 'staff', 'PATCH', { status: 'resolved' });
  assert.equal(response.status, 200);
  assert.equal(response.body.support.status, 'resolved');
  const profile = await request('/auth/profile', 'staff', 'PATCH', { name: 'Staff member' });
  assert.equal(profile.body.user.name, 'Staff member');
  assert.equal(profile.body.user.role, 'staff');
  const reply = await request('/admin/support/' + tickets[0]._id + '/reply', 'staff', 'POST', { body: 'Please send the report reference so we can assist.' });
  assert.equal(reply.status, 200);
  assert.equal(reply.body.support.replies[0].byName, 'Staff member');
});
test('expired JWTs are rejected and cookies use the same deadline as the token', async () => {
  const account = accounts[0];
  const expired = jwt.sign({ sub: account._id, role: 'user', iat: Math.floor(Date.now() / 1000) - 1801 }, process.env.JWT_SECRET, { expiresIn: 1800 });
  assert.throws(() => verifySession(expired), /expired/);
  const response = await fetch(base + '/auth/me', { headers: { Cookie: COOKIE_NAME + '=' + expired } });
  assert.equal(response.status, 401);
  assert.match(response.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
  let captured;
  const expiresAt = setSessionCookie({ cookie: (_name, token, options) => { captured = { token, options }; } }, account);
  const payload = jwt.decode(captured.token);
  assert.equal(new Date(expiresAt).getTime(), payload.exp * 1000);
  assert.equal(payload.exp - payload.iat, 1800);
  assert.ok(captured.options.maxAge <= 1800000 && captured.options.maxAge > 1798000);
  const previousLongSession = jwt.sign({ sub: account._id, role: 'user', iat: Math.floor(Date.now() / 1000) - 1801 }, process.env.JWT_SECRET, { expiresIn: '2h' });
  assert.throws(() => verifySession(previousLongSession), /maxAge exceeded/);
});

test('30-minute sessions apply to members, staff, and admins, including older two-hour tokens', async () => {
  for (const role of ['user', 'staff', 'admin']) {
    const account = accounts.find((entry) => entry._id === ids[role]);
    const payload = verifySession(signSession(account));
    assert.equal(payload.exp - payload.iat, 1800);
    const oldToken = jwt.sign({ sub: account._id, role, iat: Math.floor(Date.now() / 1000) - 1801 }, process.env.JWT_SECRET, { expiresIn: '2h' });
    const response = await fetch(base + '/auth/me', { headers: { Cookie: COOKIE_NAME + '=' + oldToken } });
    assert.equal(response.status, 401);
    assert.match(response.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
  }
});

test('staff can update and delete published content', async () => {
  const input = { title: 'Safety guidance', body: 'Never disclose one-time passwords to callers.', category: 'guide', status: 'published' };
  const created = await request('/management/content', 'staff', 'POST', input);
  const id = created.body.content._id;
  assert.equal((await request('/management/content/' + id, 'staff', 'PATCH', { ...input, title: 'Updated guide' })).body.content.title, 'Updated guide');
  assert.equal((await request('/management/content/' + id, 'staff', 'DELETE')).status, 204);
  assert.equal((await request('/site/content')).body.contents.length, 0);
});
test('a changed account role invalidates the previously issued JWT', async () => {
  const token = signSession(accounts[0]);
  accounts[0].role = 'staff';
  const response = await fetch(base + '/auth/me', { headers: { Cookie: COOKIE_NAME + '=' + token } });
  assert.equal(response.status, 401);
});

test('removed commerce APIs cannot serve products or process orders for any role', async () => {
  for (const role of ['user', 'staff', 'admin']) {
    for (const [path, method] of [['/commerce/products', 'GET'], ['/commerce/orders', 'GET'], ['/commerce/orders', 'POST']]) {
      assert.equal((await request(path, role, method, method === 'POST' ? {} : undefined)).status, 404);
    }
    for (const [path, method] of [['/management/products', 'GET'], ['/management/products', 'POST'], ['/management/products/200000000000000000000001', 'PATCH'], ['/management/products/200000000000000000000001', 'DELETE'], ['/management/orders', 'GET'], ['/management/orders/300000000000000000000001', 'PATCH']]) {
      assert.equal((await request(path, role, method, ['POST', 'PATCH'].includes(method) ? {} : undefined)).status, role === 'user' ? 403 : 404);
    }
  }
});
test('staff overview contains member, content, and support metrics', async () => {
  const response = await request('/management/overview', 'staff');
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.body).sort(), ['contents', 'openSupport', 'users']);
  assert.equal(response.body.users, 1);
});
