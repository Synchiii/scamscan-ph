const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const body = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || 'The request could not be completed.');
    Object.assign(error, body);
    throw error;
  }
  return body;
}

export const api = {
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  verifyEmail: (email, code) => request('/auth/verify-email', { method: 'POST', body: JSON.stringify({ email, code }) }),
  resendVerification: (email) => request('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  loginAsGuest: () => request('/auth/guest', { method: 'POST' }),
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
};
