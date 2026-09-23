import mongoose from 'mongoose';

export async function connectDatabase(uri) {
  if (!uri) throw new Error('MONGODB_URI is required. Copy server/.env.example to server/.env.');
  await mongoose.connect(uri);
  return mongoose.connection;
}
