import { riskClass, riskLabel } from './risk';

export default function ReportAnalysis({ report }) {
  const flags = report.flags || [];
  const signals = report.signals?.length ? report.signals : flags.map((label) => ({ label, points: 0 }));
  const max = Math.max(...signals.map((signal) => signal.points || 0), 1);
  const reportDate = report.createdAt ? new Date(report.createdAt) : new Date();
  const source = report.sourceType === 'image'
    ? `Image OCR${Number.isFinite(report.ocrConfidence) ? ` · ${report.ocrConfidence}%` : ''}`
    : report.sourceType === 'url' ? 'Website link' : 'Message text';

  return <div className="report-summary">
    <article className="score-panel">
      <div className="score-orb"><b>{report.score}</b><span>/ 100</span></div>
      <div><span className="label">RISK CLASSIFICATION</span><h2>{riskLabel(report.level)}</h2><p>{report.explanation}</p><span className={'risk-badge ' + riskClass(report.level)}>{riskLabel(report.level)}</span></div>
    </article>
    <article className="panel report-stats">
      <div><span>Source</span><b>{source}</b></div>
      <div><span>Language</span><b>{report.language || 'Not detected'}</b></div>
      <div><span>Confidence</span><b>{report.confidenceLevel || 'Legacy'}{Number.isFinite(report.confidence) ? ` · ${report.confidence}%` : ''}</b></div>
      <div><span>Signals found</span><b>{flags.length}</b></div>
      <div><span>Engine</span><b>v{report.analysisVersion || '1.0.0'}</b></div>
      <div><span>Report date</span><b>{reportDate.toLocaleDateString()}</b></div>
    </article>
    <article className="panel"><span className="label">SUBMITTED CONTENT</span><p className="report-message">{report.message || 'Submitted content is unavailable for this legacy report.'}</p></article>
    {report.urls?.length > 0 && <article className="panel"><span className="label">LINK INTELLIGENCE</span><div className="report-url-list">{report.urls.map((url) => <div key={url.host}><span><b>{url.host}</b><small>{url.verdict}</small>{url.reputationVerdict && <small>External reputation: {url.reputationVerdict}</small>}{url.providers?.map((provider) => <small key={provider.provider}>{provider.provider}: {provider.detail}</small>)}</span><strong>{url.points}/60</strong></div>)}</div></article>}
    <article className="panel"><span className="label">ANALYSIS BREAKDOWN</span><div className="signal-breakdown">{signals.length ? signals.map((signal) => <div key={`${signal.label}-${signal.category || ''}`}><div><span>{signal.label}{signal.category ? <small>{signal.category}</small> : null}</span><b>{signal.points ? '+' + signal.points : 'Detected'}</b></div><i style={{ width: ((signal.points || 0) / max * 100) + '%' }} /></div>) : <p className="report-message">No strong contextual or URL warning was detected.</p>}</div></article>
    <article className="panel action-panel"><span className="label">RECOMMENDED ACTION</span><p>{report.recommendation}</p></article>
  </div>;
}
