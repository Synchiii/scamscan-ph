import mongoose from 'mongoose';

const supportMessageSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  senderName: { type: String, required: true, maxlength: 80 },
  senderEmail: { type: String, required: true, maxlength: 254 },
  subject: { type: String, required: true, trim: true, maxlength: 140 },
  message: { type: String, required: true, trim: true, maxlength: 4000 },
  status: { type: String, enum: ['open', 'in-progress', 'resolved'], default: 'open' },
  replies: [{
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    byName: { type: String, required: true, maxlength: 80 },
    createdAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

supportMessageSchema.index({ status: 1, createdAt: -1 });
export default mongoose.model('SupportMessage', supportMessageSchema);
