import { useEffect, useState } from 'react';
import UiIcon from './UiIcon';

const example = 'Congratulations! Nanalo ka ng ₱50,000. Send your OTP and click bit.ly/claim-now to claim your prize today.';
const modes = [['text', 'Message', 'message'], ['url', 'Link', 'link'], ['image', 'Image', 'image']];

export default function DetectorPage({ scanMode, setScanMode, message, setMessage, imageFile, setImageFile, ocrProgress, analyze, analyzeImage, analysis, clearAnalysis, busy, go }) {
  const [preview, setPreview] = useState('');
  const [fileError, setFileError] = useState('');
  useEffect(() => {
    if (!imageFile) { setPreview(''); return undefined; }
    const url = URL.createObjectURL(imageFile); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);
  function chooseMode(mode) { if (busy) return; setScanMode(mode); setMessage(''); setImageFile(null); setFileError(''); clearAnalysis(); }
  function chooseImage(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) {
      setImageFile(null); setFileError('Choose a non-empty PNG, JPG or WEBP image up to 5 MB.'); return;
    }
    setFileError(''); setImageFile(file);
  }
  const title = scanMode === 'url' ? 'Paste a website link' : scanMode === 'image' ? 'Upload a screenshot' : 'Paste the message';
  return <section className="detector-studio">
    <h1 className="visually-hidden">Scam detector</h1>
    <div className="detector-studio-grid">
      <div className="detector-editor studio-card">
        <div className="studio-card-top"><span className="studio-mark"><UiIcon name="shield" /></span><span><b>Scam detector</b><small>One check. Clear next steps.</small></span><span className="studio-private"><UiIcon name="lock" size={12} /> Private</span></div>
        <div className="detector-mode-pills" role="group" aria-label="Choose content to scan">{modes.map(([mode, label, icon]) => <button type="button" key={mode} disabled={busy} className={scanMode === mode ? 'active' : ''} aria-pressed={scanMode === mode} onClick={() => chooseMode(mode)}><UiIcon name={icon} size={19} />{label}</button>)}</div>
        {scanMode === 'image' ? <div className="detector-input-body">
          <span className="studio-field-title">{title}</span><label className={'detector-image-zone' + (preview ? ' has-preview' : '')}><input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={chooseImage} aria-label="Choose a screenshot to scan" aria-invalid={Boolean(fileError)} aria-describedby={fileError ? 'detector-image-error' : undefined} />{preview ? <img src={preview} alt="Selected screenshot for scanning" /> : <><span className="upload-mark"><UiIcon name="upload" size={28} /></span><b>Choose an image</b><small>PNG, JPG or WEBP · up to 5 MB</small></>}</label>
          <div className="detector-input-foot"><span>{imageFile?.name || 'A clear screenshot works best.'}</span>{imageFile && <button type="button" disabled={busy} onClick={() => setImageFile(null)}>Remove</button>}</div>
          {fileError && <p className="studio-field-error" id="detector-image-error" role="alert">{fileError}</p>}
          {busy && <div className="detector-progress" role="progressbar" aria-valuenow={ocrProgress} aria-valuemin="0" aria-valuemax="100" aria-label="Reading screenshot text"><i style={{ width: ocrProgress + '%' }} /><span>Reading text · {ocrProgress}%</span></div>}
          <button className="primary detector-run" disabled={busy || !imageFile} onClick={analyzeImage}>{busy ? <><span className="studio-spinner" />Checking image…</> : <>Check image<UiIcon name="arrow" size={18} /></>}</button>
        </div> : <form className="detector-input-body" onSubmit={analyze}>
          <label className="studio-field-title" htmlFor="detector-content">{title}</label>
          {scanMode === 'url' ? <div className="detector-url-zone"><UiIcon name="link" size={26} /><input id="detector-content" type="url" value={message} disabled={busy} onChange={(event) => setMessage(event.target.value)} placeholder="https://example.com" maxLength="5000" required /><p>We check the link for warning signs.<br />We do not visit the website.</p></div> : <textarea id="detector-content" className="detector-text-area" value={message} disabled={busy} onChange={(event) => setMessage(event.target.value)} placeholder="Paste a suspicious SMS, email, or chat here…" minLength="10" maxLength="5000" required />}
          <div className="detector-input-foot"><button type="button" disabled={busy} onClick={() => setMessage(scanMode === 'url' ? 'https://gcas-verify-claim.ph/login' : example)}>Try an example</button><span>{message.length.toLocaleString()} / 5,000</span></div>
          <button className="primary detector-run" disabled={busy || !message.trim()}>{busy ? <><span className="studio-spinner" />Checking…</> : <>Check risk<UiIcon name="arrow" size={18} /></>}</button>
        </form>}
        <p className="detector-privacy-note"><UiIcon name="lock" size={14} />Never include passwords, OTPs, or card numbers.</p>
      </div>
      <aside className={'detector-result-card studio-card' + (analysis ? ' has-result ' + analysis.level.toLowerCase() : '')} aria-live="polite" aria-busy={busy}>
        <div className="detector-result-top"><span>Your result</span>{analysis && <span className="result-saved"><UiIcon name="check" size={13} />Saved</span>}</div>
        {analysis ? <><div className="detector-risk-orb"><b>{analysis.score}</b><span>out of 100</span></div><span className={'risk-badge ' + analysis.level.toLowerCase()}>{analysis.level} risk</span><div className="detector-confidence"><span>Analysis confidence</span><b>{analysis.confidenceLevel || 'Legacy'}{Number.isFinite(analysis.confidence) ? ` · ${analysis.confidence}%` : ''}</b></div><p className="detector-explanation">{analysis.explanation}</p><div className="detector-findings"><b>Evidence found</b>{analysis.flags.length ? <ul>{analysis.flags.slice(0, 3).map((flag) => <li key={flag}>{flag}</li>)}</ul> : <p>No strong contextual or URL warning found.</p>}{analysis.flags.length > 3 && <details><summary>{analysis.flags.length - 3} more signals</summary><ul>{analysis.flags.slice(3).map((flag) => <li key={flag}>{flag}</li>)}</ul></details>}</div>{analysis.urls?.length > 0 && <div className="detector-url-intel"><b>Link intelligence</b>{analysis.urls.map((url) => <div key={url.host}><span><strong>{url.host}</strong><small>{url.verdict}</small></span><em>{url.points}/60</em></div>)}</div>}<div className="detector-next-step"><UiIcon name="shield" size={18} /><span><b>Next step</b>{analysis.recommendation}</span></div></> : <div className="detector-ready"><div className={'detector-ready-orb' + (busy ? ' scanning' : '')}><UiIcon name="shield" size={55} /></div><h2>{busy ? 'Checking the signals…' : 'Ready when you are.'}</h2><p>{busy ? 'Your result will appear here.' : 'Add your content and run a check. We’ll explain what stands out.'}</p><div className="detector-mini-steps"><span><i>1</i>Add content</span><span><i>2</i>Check risk</span><span><i>3</i>Review result</span></div></div>}
        <div className="detector-result-bottom"><small>{analysis?.analysisVersion ? `Engine v${analysis.analysisVersion} · ` : ''}A score is guidance, not proof of safety.</small><button type="button" onClick={() => go('history')}>View history<UiIcon name="arrow" size={14} /></button></div>
      </aside>
    </div>
  </section>;
}
