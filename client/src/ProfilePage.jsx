import { useState } from 'react';
import UiIcon from './UiIcon';

export default function ProfilePage({ user, scanTotal, requestProfileChange, confirmProfileChange, busy, go }) {
  const [codeRequested, setCodeRequested] = useState(false);
  const [pendingName, setPendingName] = useState(user.name);
  const [devOtp, setDevOtp] = useState('');
  const role = { user: 'Member', staff: 'Staff', admin: 'Administrator' }[user.role] || 'Member';
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  async function submitProfile(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!codeRequested) {
      const result = await requestProfileChange(data.get('name'));
      if (result) { setPendingName(data.get('name')); setDevOtp(result.devOtp || ''); setCodeRequested(true); }
      return;
    }
    const saved = await confirmProfileChange(data.get('code'));
    if (saved) { setCodeRequested(false); setDevOtp(''); }
  }

  return <section className="profile-workspace"><h1 className="visually-hidden">Profile</h1>
    <article className="profile-identity studio-card"><div className="profile-cover" aria-hidden="true"><span /><i /><b /></div><div className="profile-identity-content"><div className="profile-initials">{initials}</div><div className="profile-name"><h2>{user.name}</h2><p>{user.email}</p><span className="profile-role-pill">{role}</span></div><span className={'profile-verification' + (user.emailVerified ? ' verified' : '')}><UiIcon name={user.emailVerified ? 'shield' : 'mail'} size={16} />{user.emailVerified ? 'Email verified' : 'Email not verified'}</span></div><div className="profile-facts"><div><span>Member since</span><b>{user.createdAt ? new Date(user.createdAt).toLocaleDateString([], { month: 'short', year: 'numeric' }) : '—'}</b></div><div><span>{user.role === 'user' ? 'Saved reports' : 'Workspace'}</span><b>{user.role === 'user' ? scanTotal : role}</b></div><div><span>Session protection</span><b>30 minutes</b></div></div></article>
    <div className="profile-editor-grid"><form className="studio-card profile-edit-form" onSubmit={submitProfile}><div className="compact-card-heading"><span className="studio-mark"><UiIcon name="user" /></span><div><h2>Profile details</h2><p>Keep your account information up to date.</p></div></div><label>Full name<input name="name" defaultValue={pendingName} minLength="2" maxLength="80" required autoComplete="name" readOnly={codeRequested} title="Letters, spaces, periods, apostrophes, and hyphens only" /></label><small>Numbers and special symbols are not allowed in names.</small><label>Email address<div className="profile-email-field"><UiIcon name="lock" size={15} /><input value={user.email} readOnly aria-readonly="true" /></div></label><small>Your verified email is managed securely through your account.</small>{codeRequested && <><label>Confirmation code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength="6" maxLength="6" placeholder="123456" required autoFocus /></label><small>Enter the six-digit code sent to your email. It expires in 10 minutes.</small>{devOtp && <small>Development code: <b>{devOtp}</b></small>}</>}<button className="primary" disabled={busy}>{busy ? (codeRequested ? 'Confirming…' : 'Sending code…') : codeRequested ? 'Confirm code & save name' : 'Send confirmation code'}<UiIcon name="check" size={17} /></button>{codeRequested && <button type="button" className="text-button" disabled={busy} onClick={() => { setCodeRequested(false); setDevOtp(''); }}>Cancel name change</button>}</form><aside className="studio-card profile-security-card"><span className="profile-security-icon"><UiIcon name="shield" size={35} /></span><h2>Your account. Protected.</h2><p>Manage your password and preferences in one place.</p><div><UiIcon name="check" size={16} />Automatic sign-out after 30 minutes</div><div><UiIcon name="check" size={16} />Private reports and conversations</div><button className="secondary" onClick={() => go('settings')}>Security settings<UiIcon name="arrow" size={16} /></button></aside></div>
  </section>;
}
