import mongoose from 'mongoose';

const chatThreadSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  assignedStaff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  claimedAt: { type: Date, default: null },
  lastMessageAt: { type: Date, default: Date.now },
  lastMessagePreview: { type: String, maxlength: 160, default: '' },
  lastSenderRole: { type: String, enum: ['user', 'staff'], default: 'user' },
}, { timestamps: true });

chatThreadSchema.index({ assignedStaff: 1, lastMessageAt: -1, _id: -1 });
chatThreadSchema.index({ lastMessageAt: -1, _id: -1 });
export default mongoose.model('ChatThread', chatThreadSchema);
