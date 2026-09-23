import mongoose from 'mongoose';

const messageAnalysisSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  language: { type: String, required: true },
  score: { type: Number, required: true, min: 0, max: 100 },
  level: { type: String, required: true, enum: ['Safe', 'Warning', 'High', 'Scam'] },
  flags: [{ type: String }],
  signals: [{ label: String, points: Number }],
  explanation: { type: String, required: true },
  recommendation: { type: String, required: true },
  adminReview: {
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    byName: String,
    note: { type: String, maxlength: 500 },
    reviewedAt: Date,
  },
}, { timestamps: true });

export default mongoose.model('MessageAnalysis', messageAnalysisSchema);
