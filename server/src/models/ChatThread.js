import mongoose from 'mongoose';

const chatThreadSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  lastMessageAt: { type: Date, default: Date.now },
  lastMessagePreview: { type: String, maxlength: 160, default: '' },
  lastSenderRole: { type: String, enum: ['user', 'staff', 'admin'], default: 'user' },
}, { timestamps: true });

chatThreadSchema.index({ lastMessageAt: -1, _id: -1 });
export default mongoose.model('ChatThread', chatThreadSchema);
