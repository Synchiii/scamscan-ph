import 'dotenv/config';
import { connectDatabase } from './config/db.js';
import MessageAnalysis from './models/MessageAnalysis.js';
import SecurityEvent from './models/SecurityEvent.js';
import User from './models/User.js';
import { scoreScamMessage } from './services/scamScorer.js';
import { scoreSecurityEvent } from './services/threatScorer.js';

const messages = [
  'Congratulations! Nanalo ka ng ₱50,000. Send your OTP and click https://bit.ly/claim-now to claim today!',
  'Your GCash account will be suspended. Please verify your account para hindi ma-disable.',
  'Hi, your package is ready for pickup at the barangay hall tomorrow.',
  'Congrats lods! Winner ka ng 20k. I-click ang link now para ma-claim ang premyo.',
];
const events = [
  { type: 'login', actor: 'demo.user', ip: '185.220.101.8', device: 'Unknown device', location: 'Unknown', failedAttempts: 10, isNewDevice: true, isUnknownIp: true, isUnusualTime: true },
  { type: 'file', actor: 'demo.user', ip: '185.220.101.8', device: 'Unknown device', location: 'Unknown', fileCount: 160, restrictedFolder: true },
  { type: 'network', actor: 'sensor', ip: '10.0.0.4', device: 'Lab sensor', location: 'Lab', portScan: true, unusualTraffic: true },
];

try {
  await connectDatabase(process.env.MONGODB_URI);
  const admin = await User.findOne({ role: 'admin' });
  if (!admin) throw new Error('Create an administrator first with npm run create-admin.');
  await Promise.all([MessageAnalysis.deleteMany({}), SecurityEvent.deleteMany({})]);
  await MessageAnalysis.insertMany(messages.map((message) => ({ user: admin._id, message, ...scoreScamMessage(message) })));
  await SecurityEvent.insertMany(events.map((event) => ({ submittedBy: admin._id, ...event, ...scoreSecurityEvent(event) })));
  console.log('Database seeded with safe, simulated capstone data.');
  process.exit(0);
} catch (error) {
  console.error(`Seeding failed: ${error.message}`);
  process.exit(1);
}
