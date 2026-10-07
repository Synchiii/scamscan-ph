import mongoose from 'mongoose';

export const DEFAULT_MAINTENANCE_MESSAGE = 'ScamScan is undergoing maintenance. Please check back shortly.';

const schema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'site' },
  maintenanceEnabled: { type: Boolean, default: false },
  maintenanceMessage: { type: String, maxlength: 500, default: DEFAULT_MAINTENANCE_MESSAGE },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model('SiteSettings', schema);
