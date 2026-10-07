import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'staff', 'admin'], default: 'user' },
  emailVerified: { type: Boolean, default: true },
  verificationCodeHash: { type: String, select: false },
  verificationCodeExpires: { type: Date, select: false },
  isActive: { type: Boolean, default: true },
  failedLoginAttempts: { type: Number, default: 0, select: false },
  loginLockedUntil: { type: Date, select: false },
  loginLockLevel: { type: Number, default: 0, select: false },
  preferences: {
    emailNotifications: { type: Boolean, default: true },
    scanTips: { type: Boolean, default: true },
  },
  resetPasswordHash: { type: String, select: false },
  resetPasswordExpires: { type: Date, select: false },
  passwordChangeCodeHash: { type: String, select: false },
  passwordChangeCodeExpires: { type: Date, select: false },
  passwordChangeCodeAttempts: { type: Number, default: 0, select: false },
  passwordChangeCodeLastSentAt: { type: Date, select: false },
}, { timestamps: true });

export default mongoose.model('User', userSchema);
