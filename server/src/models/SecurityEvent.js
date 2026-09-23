import mongoose from 'mongoose';

const securityEventSchema = new mongoose.Schema({
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true, enum: ['login', 'file', 'network', 'behavior'] },
  actor: { type: String, required: true, trim: true, maxlength: 100 },
  ip: { type: String, default: 'Not recorded' },
  device: { type: String, default: 'Not recorded' },
  location: { type: String, default: 'Not recorded' },
  occurredAt: { type: Date, default: Date.now },
  failedAttempts: { type: Number, default: 0, min: 0 },
  fileCount: { type: Number, default: 0, min: 0 },
  fileAction: { type: String, enum: ['none', 'access', 'edit', 'delete', 'rename', 'create'], default: 'none' },
  isNewDevice: { type: Boolean, default: false },
  isUnknownIp: { type: Boolean, default: false },
  isUnusualTime: { type: Boolean, default: false },
  restrictedFolder: { type: Boolean, default: false },
  portScan: { type: Boolean, default: false },
  unusualTraffic: { type: Boolean, default: false },
  score: { type: Number, required: true, min: 0, max: 100 },
  severity: { type: String, required: true, enum: ['Low', 'Medium', 'High', 'Critical'] },
  factors: [{ type: String }],
  baselineFlags: [{ type: String }],
  summary: { type: String, required: true },
  status: { type: String, enum: ['open', 'acknowledged', 'resolved'], default: 'open' },
  responseNote: { type: String, maxlength: 500, default: '' },
}, { timestamps: true });

securityEventSchema.index({ createdAt: -1 });
securityEventSchema.index({ severity: 1, createdAt: -1 });
export default mongoose.model('SecurityEvent', securityEventSchema);
