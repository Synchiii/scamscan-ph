import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
  body: { type: String, required: true, trim: true, minlength: 10, maxlength: 5000 },
  category: { type: String, enum: ['guide', 'announcement', 'news'], default: 'guide' },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
schema.index({ status: 1, updatedAt: -1 });
export default mongoose.model('Content', schema);
