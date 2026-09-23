import mongoose from 'mongoose';

const pendingRegistrationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  codeHash: { type: String, required: true, select: false },
  codeExpiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  lastSentAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

pendingRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model('PendingRegistration', pendingRegistrationSchema);
