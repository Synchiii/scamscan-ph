import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isGuest: { type: Boolean, default: false },
  emailVerified: { type: Boolean, default: true },
  verificationCodeHash: { type: String, select: false },
  verificationCodeExpires: { type: Date, select: false },
  isActive: { type: Boolean, default: true },
  failedLoginAttempts: { type: Number, default: 0, select: false },
  loginLockedUntil: { type: Date, select: false },
  preferences: {
    emailNotifications: { type: Boolean, default: true },
    scanTips: { type: Boolean, default: true },
  },
  resetPasswordHash: { type: String, select: false },
  resetPasswordExpires: { type: Date, select: false },
}, { timestamps: true });

export default mongoose.model('User', userSchema);
