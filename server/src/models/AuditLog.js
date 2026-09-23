import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  actorName: { type: String, required: true, maxlength: 80 },
  actorEmail: { type: String, required: true, maxlength: 254 },
  actorRole: { type: String, required: true, enum: ['user', 'admin', 'guest', 'system'] },
  action: { type: String, required: true, maxlength: 100, index: true },
  targetType: { type: String, maxlength: 50 },
  targetId: { type: String, maxlength: 100 },
  details: { type: String, maxlength: 500 },
  ip: { type: String, maxlength: 100 },
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });
export default mongoose.model('AuditLog', auditLogSchema);
