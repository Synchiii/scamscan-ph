import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
  thread: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatThread', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true, maxlength: 80 },
  senderRole: { type: String, enum: ['user', 'staff', 'admin'], required: true },
  body: { type: String, required: function () { return !this.attachments?.length; }, trim: true, maxlength: 2000, default: '' },
  attachments: [{
    _id: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, maxlength: 120 },
    contentType: { type: String, required: true },
    kind: { type: String, enum: ['image', 'video', 'audio', 'file'], required: true },
    size: { type: Number, required: true, min: 1, max: 25 * 1024 * 1024 },
  }],
}, { timestamps: true });

chatMessageSchema.index({ thread: 1, _id: -1 });
chatMessageSchema.path('attachments').validate((files) => files.length <= 3, 'Use at most three attachments.');
export default mongoose.model('ChatMessage', chatMessageSchema);
