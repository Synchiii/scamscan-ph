import mongoose from 'mongoose';
import { validPersonName, personNameHelp } from '../utils/personName.js';

const pendingRegistrationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80, validate: { validator: validPersonName, message: personNameHelp } },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  codeHash: { type: String, required: true, select: false },
  requestedRole: { type: String, enum: ['user', 'staff'], default: 'user' },
  emailVerifiedAt: { type: Date },
  approvalStatus: { type: String, enum: ['not_required', 'pending'], default: 'not_required' },
  codeExpiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  lastSentAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

pendingRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model('PendingRegistration', pendingRegistrationSchema);
