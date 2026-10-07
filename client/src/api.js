const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const SESSION_EXPIRED_EVENT = 'scamscan:session-expired';
export const MAINTENANCE_EVENT = 'scamscan:maintenance';
let authGeneration = 0;
export function invalidateRequests() { authGeneration += 1; }
const PUBLIC_AUTH_PATHS = new Set([
  '/auth/register',
  '/auth/verify-email',
  '/auth/resend-verification',
  '/auth/login',
  '/auth/me',
  '/auth/forgot-password',
  '/auth/reset-password',
]);

async function request(path, options = {}) {
  const generation = authGeneration;
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const body = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || 'The request could not be completed.');
    Object.assign(error, body);
    error.status = response.status;
    if (response.status === 401 && !PUBLIC_AUTH_PATHS.has(path) && generation === authGeneration) {
      error.sessionExpired = true;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { message: error.message } }));
      }
    }
    if (body.code === 'MAINTENANCE_MODE' && generation === authGeneration && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(MAINTENANCE_EVENT, { detail: { message: error.message } }));
    }
    throw error;
  }
  return body;
}

export const api = {
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  verifyEmail: (email, code) => request('/auth/verify-email', { method: 'POST', body: JSON.stringify({ email, code }) }),
  resendVerification: (email) => request('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getMe: () => request('/auth/me'),
  updateProfile: (name) => request('/auth/profile', { method: 'PATCH', body: JSON.stringify({ name }) }),
  updatePreferences: (preferences) => request('/auth/preferences', { method: 'PATCH', body: JSON.stringify({ preferences }) }),
  changePassword: (currentPassword, newPassword) => request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (email, code, password) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, code, password }) }),
  analyzeMessage: (message) => request('/scam/analyze', { method: 'POST', body: JSON.stringify({ message }) }),
  getScamHistory: ({ page = 1, level = 'All' } = {}) => request(`/scam/history?page=${page}${level === 'All' ? '' : `&level=${encodeURIComponent(level)}`}`),
  deleteScan: (id) => request(`/scam/history/${id}`, { method: 'DELETE' }),
  getScamAnalytics: () => request('/scam/analytics'),
  getThreatDashboard: () => request('/threats/dashboard'),
  createEvent: (event) => request('/threats/events', { method: 'POST', body: JSON.stringify(event) }),
  updateAlertStatus: (id, status) => request(`/threats/events/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  seedDemo: () => request('/threats/demo-seed', { method: 'POST' }),
  getUsers: () => request('/admin/users'),
  updateUser: (id, data) => request(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),
  getUserDetails: (id) => request(`/admin/users/${id}/details`),
  getAdminOverview: () => request('/admin/overview'),
  getAdminReports: ({ page = 1, level = 'All' } = {}) => request(`/admin/reports?page=${page}${level === 'All' ? '' : `&level=${encodeURIComponent(level)}`}`),
  updateAdminReport: (id, data) => request(`/admin/reports/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getAuditLogs: () => request('/admin/audit-logs'),
  getAdminSupport: () => request('/admin/support'),
  updateSupportStatus: (id, status) => request(`/admin/support/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  replyToSupport: (id, body) => request(`/admin/support/${id}/reply`, { method: 'POST', body: JSON.stringify({ body }) }),
  sendSupport: (subject, message) => request('/support', { method: 'POST', body: JSON.stringify({ subject, message }) }),
  getMySupport: () => request('/support/mine'),
  getChatThreads: (page = 1, options = {}) => request(`/chat/threads?page=${page}`, options),
  startChat: (options = {}) => request('/chat/threads', { ...options, method: 'POST' }),
  getChatMessages: (id, { before, ...options } = {}) => request(`/chat/threads/${id}/messages${before ? '?before=' + encodeURIComponent(before) : ''}`, options),
  sendChatMessage: (id, body, { attachments = [], ...options } = {}) => request(`/chat/threads/${id}/messages`, { ...options, method: 'POST', body: JSON.stringify({ body, attachments }) }),
  claimChatThread: (id, options = {}) => request(`/chat/threads/${id}/claim`, { ...options, method: 'POST' }),
  uploadChatAttachment: (id, file, contentType, options = {}) => request(`/chat/threads/${id}/attachments`, { ...options, method: 'POST', body: file, headers: { 'Content-Type': contentType, 'X-File-Name': encodeURIComponent(file.name) } }),
  removeChatAttachment: (id, fileId) => request(`/chat/threads/${id}/attachments/${fileId}`, { method: 'DELETE' }),
  chatAttachmentUrl: (id, fileId, download = false) => `${API_URL}/chat/threads/${id}/attachments/${fileId}${download ? '?download=1' : ''}`,
  getSiteStatus: () => request('/site/status'),
  getPublishedContent: () => request('/site/content'),
  getMaintenance: () => request('/admin/maintenance'),
  updateMaintenance: (data) => request('/admin/maintenance', { method: 'PATCH', body: JSON.stringify(data) }),
  getStaffOverview: () => request('/management/overview'),
  getContent: () => request('/management/content'),
  saveContent: (id, data) => request('/management/content' + (id ? '/' + id : ''), { method: id ? 'PATCH' : 'POST', body: JSON.stringify(data) }),
  deleteContent: (id) => request('/management/content/' + id, { method: 'DELETE' }),
};


