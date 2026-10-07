import { useEffect, useRef, useState } from 'react';
import ChatPage from './ChatPage';
import UiIcon from './UiIcon';

export default function ChatWidget({ user, open, setOpen }) {
  const [openedOnce, setOpenedOnce] = useState(open);
  const launcher = useRef(null);
  const panel = useRef(null);
  const manager = ['staff', 'admin'].includes(user.role);
  function close() { setOpen(false); launcher.current?.focus({ preventScroll: true }); }
  useEffect(() => { if (open) setOpenedOnce(true); }, [open]);
  useEffect(() => {
    if (!open) { panel.current?.querySelectorAll('video,audio').forEach((media) => media.pause()); return undefined; }
    panel.current?.focus({ preventScroll: true });
    const onKey = (event) => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, openedOnce]);
  return <div className={'floating-chat' + (open ? ' is-open' : '')}>
    {openedOnce && <section className={'floating-chat-panel' + (manager ? ' manager-panel' : '')} id="scamscan-chat-popup" ref={panel} tabIndex="-1" role="dialog" aria-label={manager ? 'Member support inbox' : 'Chat with ScamScan Staff'} hidden={!open}>
      <div className="floating-chat-heading"><span className="floating-chat-brand"><UiIcon name="message" size={20} /></span><div><b>{manager ? 'Member support' : 'ScamScan Staff'}</b><small>Private conversations</small></div><button type="button" onClick={close} aria-label="Minimize chat"><UiIcon name="close" size={19} /></button></div>
      <ChatPage user={user} active={open} />
    </section>}
    <button type="button" className="floating-chat-launcher" ref={launcher} aria-label={open ? 'Minimize support chat' : 'Open support chat'} aria-expanded={open} aria-controls={openedOnce ? 'scamscan-chat-popup' : undefined} onClick={() => setOpen(!open)}><UiIcon name={open ? 'close' : 'message'} size={25} /><span>{open ? 'Close' : 'Chat'}</span></button>
  </div>;
}
