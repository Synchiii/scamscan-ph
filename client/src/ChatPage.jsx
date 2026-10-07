import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import UiIcon from './UiIcon';
import { chatFileAccept, describeChatFile, formatFileSize } from './chatMedia';

export function mergeChatMessages(previous, incoming) {
  return [...new Map([...previous, ...incoming].map((message) => [message._id, message])).values()].sort((a, b) => a._id.localeCompare(b._id));
}

export function ChatAttachmentView({ attachment, threadId }) {
  const url = api.chatAttachmentUrl(threadId, attachment._id);
  return <div className={'chat-attachment-view ' + attachment.kind}>
    {attachment.kind === 'image' && <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} crossOrigin="use-credentials" loading="lazy" alt={attachment.name} /></a>}
    {attachment.kind === 'video' && <video src={url} crossOrigin="use-credentials" controls preload="metadata" aria-label={attachment.name} />}
    {attachment.kind === 'audio' && <audio src={url} crossOrigin="use-credentials" controls preload="metadata" aria-label={attachment.name} />}
    <a className="chat-attachment-download" href={api.chatAttachmentUrl(threadId, attachment._id, true)} target="_blank" rel="noopener noreferrer"><UiIcon name={attachment.kind === 'file' ? 'file' : attachment.kind} size={16} /><span><b>{attachment.name}</b><small>{formatFileSize(attachment.size)}</small></span><UiIcon name="arrow" size={14} /></a>
  </div>;
}
function SelectedChatFile({ entry, remove, disabled }) {
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (entry.kind !== 'image') return undefined;
    const url = URL.createObjectURL(entry.file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [entry.file]);
  return <div className="selected-chat-file">{preview ? <img src={preview} alt="" /> : <UiIcon name={entry.kind === 'file' ? 'file' : entry.kind} size={23} />}<span><b>{entry.file.name}</b><small>{formatFileSize(entry.file.size)}</small></span><button type="button" disabled={disabled} onClick={remove} aria-label={'Remove ' + entry.file.name}><UiIcon name="close" size={14} /></button></div>;
}
export default function ChatPage({ user, active = true }) {
  const manager = user.role === 'staff';
  const [threads, setThreads] = useState([]);
  const [threadId, setThreadId] = useState(null);
  const [threadPage, setThreadPage] = useState(1);
  const [threadPages, setThreadPages] = useState(1);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showInbox, setShowInbox] = useState(manager);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef(null);
  const uploaded = useRef(new Map());
  const previousThread = useRef(null);
  const enabled = useRef(active);
  enabled.current = active;
  const listRefresh = useRef(null);
  const messageRefresh = useRef(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');
  const [connection, setConnection] = useState('Connecting…');
  const [listVersion, setListVersion] = useState(0);
  const messagePane = useRef(null);
  const mounted = useRef(false);
  const selectedId = useRef(threadId);
  selectedId.current = threadId;
  const controllers = useRef(new Set());
  const thread = threads.find((item) => item._id === threadId);
  const waitingForClaim = Boolean(threadId && !thread?.assignedStaff);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; for (const controller of controllers.current) controller.abort(); };
  }, []);

  useEffect(() => {
    if (!active) return;
    listRefresh.current?.(); messageRefresh.current?.();
  }, [active]);
  useEffect(() => {
    let active = true;
    let fetching = false;
    const controller = new AbortController();
    async function refresh() {
      if (!active || fetching || !enabled.current || document.visibilityState === 'hidden') return;
      fetching = true;
      try {
        const result = await api.getChatThreads(threadPage, { signal: controller.signal });
        if (!active) return;
        setThreads(result.threads); setThreadPages(result.pages);
        if (result.page !== threadPage) setThreadPage(result.page);
        setThreadId((current) => result.threads.some((item) => item._id === current) ? current : result.threads[0]?._id || null);
        setConnection('Updates automatically');
      } catch (failure) {
        if (active && failure.name !== 'AbortError') { setConnection('Connection interrupted'); setError(failure.message); }
      } finally { fetching = false; if (active) setLoadingList(false); }
    }
    listRefresh.current = refresh;
    setLoadingList(true); refresh();
    const timer = setInterval(refresh, 30000);
    const resume = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', resume); document.addEventListener('visibilitychange', resume);
    return () => { active = false; controller.abort(); clearInterval(timer); window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume); };
  }, [threadPage, listVersion]);

  useEffect(() => {
    setMessages([]); setHasOlder(false); setLoadingOlder(false); setError('');
    if (previousThread.current && previousThread.current !== threadId) {
      setDraft(''); setSelectedFiles([]);
      for (const pending of uploaded.current.values()) api.removeChatAttachment(pending.thread, pending._id).catch(() => {});
      uploaded.current.clear();
    }
    previousThread.current = threadId;
    if (!threadId) { setLoadingMessages(false); return undefined; }
    let active = true;
    let fetching = false;
    let first = true;
    const controller = new AbortController();
    async function refresh() {
      if (!active || fetching || !enabled.current || document.visibilityState === 'hidden') return;
      fetching = true;
      try {
        const result = await api.getChatMessages(threadId, { signal: controller.signal });
        if (!active) return;
        const pane = messagePane.current;
        const nearBottom = !pane || pane.scrollHeight - pane.scrollTop - pane.clientHeight < 100;
        setMessages((previous) => mergeChatMessages(previous, result.messages));
        if (first) setHasOlder(result.hasOlder);
        if (first || nearBottom) requestAnimationFrame(() => { if (active && messagePane.current) messagePane.current.scrollTop = messagePane.current.scrollHeight; });
        first = false; setConnection('Updates automatically');
      } catch (failure) {
        if (active && failure.name !== 'AbortError') { setConnection('Connection interrupted'); setError(failure.message); }
      } finally { fetching = false; if (active) setLoadingMessages(false); }
    }
    messageRefresh.current = refresh;
    setLoadingMessages(true); refresh();
    const timer = setInterval(refresh, 10000);
    const resume = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', resume); document.addEventListener('visibilitychange', resume);
    return () => { active = false; controller.abort(); clearInterval(timer); window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume); };
  }, [threadId]);

  async function loadOlder() {
    if (!messages.length || loadingOlder) return;
    const id = threadId;
    const pane = messagePane.current;
    const height = pane?.scrollHeight || 0;
    const controller = new AbortController(); controllers.current.add(controller);
    setLoadingOlder(true); setError('');
    try {
      const result = await api.getChatMessages(id, { before: messages[0]._id, signal: controller.signal });
      if (!mounted.current || selectedId.current !== id) return;
      setMessages((previous) => mergeChatMessages(previous, result.messages)); setHasOlder(result.hasOlder);
      requestAnimationFrame(() => { if (mounted.current && selectedId.current === id && pane) pane.scrollTop += pane.scrollHeight - height; });
    } catch (failure) { if (mounted.current && selectedId.current === id && failure.name !== 'AbortError') setError(failure.message); }
    finally { controllers.current.delete(controller); if (mounted.current && selectedId.current === id) setLoadingOlder(false); }
  }

  function chooseFiles(event) {
    try {
      const additions = Array.from(event.target.files || []).map(describeChatFile);
      const unique = [...selectedFiles, ...additions].filter((entry, index, all) => all.findIndex((other) => other.file.name === entry.file.name && other.file.size === entry.file.size && other.file.lastModified === entry.file.lastModified) === index);
      if (unique.length > 3) throw new Error('Choose up to three files per message.');
      setSelectedFiles(unique); setError('');
    } catch (failure) { setError(failure.message); }
    event.target.value = '';
  }
  function removeFile(entry) {
    const pending = uploaded.current.get(entry.file);
    if (pending) { api.removeChatAttachment(pending.thread, pending._id).catch(() => {}); uploaded.current.delete(entry.file); }
    setSelectedFiles((previous) => previous.filter((item) => item.file !== entry.file));
  }
  async function claimConversation() {
    if (!threadId || claiming || !manager) return;
    const id = threadId;
    setClaiming(true); setError('');
    try {
      const result = await api.claimChatThread(id);
      if (!mounted.current || selectedId.current !== id) return;
      setThreads((previous) => previous.map((item) => item._id === id ? { ...item, ...result.thread } : item));
      setListVersion((value) => value + 1);
    } catch (failure) { if (mounted.current && selectedId.current === id) setError(failure.message); }
    finally { if (mounted.current && selectedId.current === id) setClaiming(false); }
  }
  async function send(event) {
    event.preventDefault();
    const body = draft.trim();
    const files = [...selectedFiles];
    if ((!body && !files.length) || sending || (manager && (!threadId || !thread?.assignedStaff))) return;
    if (body.length > 2000) { setError('Keep your message within 2,000 characters.'); return; }
    const originalId = threadId;
    let id = originalId;
    const controller = new AbortController(); controllers.current.add(controller);
    setSending(true); setError('');
    try {
      if (!id) {
        const result = await api.startChat({ signal: controller.signal });
        if (!mounted.current) return;
        id = result.thread._id; selectedId.current = id;
        setThreads([{ ...result.thread, user }]); setThreadId(id);
      }
      const ids = [];
      for (const entry of files) {
        if (!mounted.current || selectedId.current !== id) return;
        let attachment = uploaded.current.get(entry.file);
        if (!attachment) {
          setUploading(true);
          const result = await api.uploadChatAttachment(id, entry.file, entry.contentType, { signal: controller.signal });
          attachment = { ...result.attachment, thread: id };
          uploaded.current.set(entry.file, attachment);
        }
        ids.push(attachment._id);
      }
      setUploading(false);
      const result = await api.sendChatMessage(id, body, { attachments: ids, signal: controller.signal });
      for (const entry of files) uploaded.current.delete(entry.file);
      if (!mounted.current || selectedId.current !== id) return;
      setMessages((previous) => mergeChatMessages(previous, [result.message])); setDraft(''); setSelectedFiles([]);
      setThreads((previous) => previous.map((item) => item._id === id ? { ...item, lastMessagePreview: body || 'Attachment · ' + files[0]?.file.name, lastMessageAt: result.message.createdAt } : item));
      requestAnimationFrame(() => { if (mounted.current && messagePane.current) messagePane.current.scrollTop = messagePane.current.scrollHeight; });
    } catch (failure) { if (mounted.current && failure.name !== 'AbortError' && (selectedId.current === id || selectedId.current === originalId)) { setDraft(body); setSelectedFiles(files); setError(failure.message); } }
    finally { controllers.current.delete(controller); if (mounted.current) { setSending(false); setUploading(false); } }
  }

  return <section className="chat-page">
    <h1 className="visually-hidden">{manager ? 'Member conversations' : 'Chat with Staff'}</h1>
    <div className={'chat-workspace' + (manager ? ' chat-manager' : '') + (showInbox ? ' inbox-visible' : '')}>
      {manager && <aside className="chat-inbox"><div className="chat-inbox-heading"><b>Support inbox</b><button className="text-button" onClick={() => setListVersion((value) => value + 1)} disabled={loadingList}>Refresh</button></div><div className="chat-thread-list">{loadingList && !threads.length ? <p className="chat-empty">Loading conversations…</p> : !threads.length ? <p className="chat-empty">No member conversations yet.</p> : threads.map((item) => <button className={'chat-thread' + (item._id === threadId ? ' active' : '')} key={item._id} disabled={sending} onClick={() => { setThreadId(item._id); setShowInbox(false); }}><span className="chat-avatar">{item.user?.name?.slice(0, 1).toUpperCase() || '?'}</span><span><b>{item.user?.name || 'Member'}</b><small>{item.lastMessagePreview || 'New conversation'}</small><small>{item.assignedStaff ? 'Claimed by you' : 'Unclaimed · claim to reply'}</small><time>{new Date(item.lastMessageAt).toLocaleDateString()}</time></span><UiIcon name="chevron" size={15} /></button>)}</div>{threadPages > 1 && <div className="chat-inbox-pages"><button className="secondary" aria-label="Previous conversation page" disabled={sending || threadPage <= 1} onClick={() => setThreadPage(threadPage - 1)}>←</button><span>{threadPage} / {threadPages}</span><button className="secondary" aria-label="Next conversation page" disabled={sending || threadPage >= threadPages} onClick={() => setThreadPage(threadPage + 1)}>→</button></div>}</aside>}
      <div className="chat-conversation"><div className="chat-conversation-heading">{manager && <button className="chat-back-button" type="button" onClick={() => setShowInbox(true)} aria-label="Back to support inbox"><UiIcon name="back" size={19} /></button>}<div className="chat-avatar">{manager ? thread?.user?.name?.slice(0, 1).toUpperCase() || '?' : 'S'}</div><div><h2>{manager ? thread?.user?.name || 'Choose a conversation' : 'Support team'}</h2><span>{connection}</span></div><span className="chat-private-label">Private</span></div>
        
        {manager && threadId && waitingForClaim && <div className="chat-error"><b>Unclaimed member request.</b> Claim this conversation to reply privately. <button type="button" className="secondary" disabled={claiming} onClick={claimConversation}>{claiming ? 'Claiming…' : 'Claim request'}</button></div>}
        {!manager && threadId && waitingForClaim && <div className="chat-error">Your request is waiting for an available Staff member to claim it. You can add details, but Staff can reply after claiming the request.</div>}        <div className="chat-messages" ref={messagePane} role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation messages" aria-busy={loadingMessages}>
          {hasOlder && <button className="chat-load-older" disabled={loadingOlder} onClick={loadOlder}>{loadingOlder ? 'Loading…' : 'Load earlier messages'}</button>}
          {loadingMessages ? <p className="chat-empty">Loading messages…</p> : !messages.length ? <div className="chat-welcome"><span aria-hidden="true"><UiIcon name="message" size={40} /></span><h3>{manager ? (waitingForClaim ? 'Claim this request' : 'Ready to help') : (waitingForClaim ? 'Waiting for Staff' : 'How can we help?')}</h3><p>{manager ? (waitingForClaim ? 'Review the member request, then claim it to begin the private conversation.' : 'Reply to your claimed member request below.') : (waitingForClaim ? 'An available Staff member will claim your request soon.' : 'Send a message or attachment. Your claimed Staff member can reply here.')}</p></div> : messages.map((message) => <article key={message._id} className={'chat-bubble ' + (String(message.sender) === String(user.id) ? 'outgoing' : 'incoming')}><div><b>{message.senderName}</b><span>{message.senderRole === 'user' ? 'Member' : message.senderRole === 'admin' ? 'Admin' : 'Staff'}</span></div>{message.body && <p>{message.body}</p>}{message.attachments?.map((attachment) => <ChatAttachmentView key={attachment._id} attachment={attachment} threadId={threadId} />)}<time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></article>)}
        </div>
        <form className="chat-composer" onSubmit={send}>{error && <p className="chat-error" role="alert">{error}</p>}{selectedFiles.length > 0 && <div className="selected-chat-files">{selectedFiles.map((entry, index) => <SelectedChatFile key={entry.file.name + index} entry={entry} remove={() => removeFile(entry)} disabled={sending} />)}</div>}<label htmlFor="chat-message" className="visually-hidden">Message to {manager ? 'member' : 'Staff'}</label><div className="chat-composer-row"><input type="file" ref={fileInput} className="visually-hidden" multiple accept={chatFileAccept} onChange={chooseFiles} disabled={sending || (manager && (!threadId || !thread?.assignedStaff))} aria-label="Choose chat attachments" /><button className="chat-attach-button" type="button" onClick={() => fileInput.current?.click()} disabled={sending || loadingList || (manager && (!threadId || !thread?.assignedStaff))} aria-label="Attach images, videos, audio, or files" title="Add an attachment"><UiIcon name="clip" size={21} /></button><textarea id="chat-message" value={draft} maxLength="2000" rows="1" disabled={sending || loadingList || loadingMessages || (manager && (!threadId || !thread?.assignedStaff))} onChange={(event) => setDraft(event.target.value)} placeholder={manager ? 'Write a reply…' : 'Write a message…'} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } }} /><button className="primary chat-send-button" aria-label={uploading ? 'Uploading attachments' : sending ? 'Sending message' : 'Send message'} disabled={sending || loadingList || loadingMessages || (!draft.trim() && !selectedFiles.length) || (manager && (!threadId || !thread?.assignedStaff))}>{sending ? <span className="studio-spinner" /> : <UiIcon name="arrow" size={19} />}</button></div><small><span>Never share passwords, OTPs, or card numbers.</span><span>{uploading ? 'Uploading…' : draft.length + '/2000'}</span></small><p className="chat-upload-hint">Images 5 MB · Videos 25 MB · Audio/files 10 MB. Only you and the Staff member who claims this chat can read it.</p></form>
      </div>
    </div>
  </section>;
}

