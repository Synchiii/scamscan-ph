import mongoose from 'mongoose';

const messageAnalysisSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  sourceType: { type: String, enum: ['text', 'url', 'image'], default: 'text' },
  ocrConfidence: { type: Number, min: 0, max: 100, default: null },
  language: { type: String, required: true },
  score: { type: Number, required: true, min: 0, max: 100 },
  level: { type: String, required: true, enum: ['Safe', 'Warning', 'High', 'Scam'] },
  confidence: { type: Number, min: 0, max: 100, default: 0 },
  confidenceLevel: { type: String, enum: ['Low', 'Moderate', 'High'], default: 'Low' },
  analysisVersion: { type: String, default: '1.0.0' },
  flags: [{ type: String }],
  signals: [{ label: String, points: Number, category: String, evidence: String }],
  urls: [{
    host: String, points: Number, verdict: String, reasons: [String], reputationVerdict: String,
    providers: [{ provider: String, verdict: String, malicious: Number, suspicious: Number, harmless: Number, threats: [String], detail: String }],
  }],
  externalChecks: { configured: Boolean, checked: Number, status: String },
  explanation: { type: String, required: true },
  recommendation: { type: String, required: true },
  adminReview: {
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    byName: String,
    note: { type: String, maxlength: 500 },
    reviewedAt: Date,
  },
}, { timestamps: true });

export default mongoose.model('MessageAnalysis', messageAnalysisSchema);
