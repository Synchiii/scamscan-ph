// Compatibility filter keeps records created by the removed guest feature inaccessible.
export const registeredAccounts = { isGuest: { $ne: true } };

export function managedAccountQuery(actor, id) {
  return { ...registeredAccounts, ...(id ? { _id: id } : {}), ...(actor.role === 'staff' ? { role: 'user' } : {}) };
}

export function canSetRole(actor, role) {
  return actor.role === 'admin' && ['user', 'staff', 'admin'].includes(role);
}

