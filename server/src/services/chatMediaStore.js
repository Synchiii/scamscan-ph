import mongoose from 'mongoose';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const bucketName = 'chat_uploads';
const oid = (value) => new mongoose.Types.ObjectId(String(value));
function storage() {
  if (!mongoose.connection.db) throw Object.assign(new Error('Attachment storage is unavailable. Try again shortly.'), { status: 503 });
  return { bucket: new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName }), files: mongoose.connection.db.collection(bucketName + '.files') };
}
export const chatMediaStore = {
  async save(buffer, file, thread, sender) {
    const { bucket, files } = storage();
    // Clean up only this sender's abandoned, unsent uploads after 24 hours.
    const abandoned = await files.find({ 'metadata.sender': oid(sender), 'metadata.state': 'pending', uploadDate: { $lt: new Date(Date.now() - 86400000) } }).limit(10).toArray();
    await Promise.all(abandoned.map((entry) => chatMediaStore.removePending(entry._id, entry.metadata.thread, sender)));
    const upload = bucket.openUploadStream(file.name, { metadata: { thread: oid(thread), sender: oid(sender), state: 'pending', contentType: file.contentType, kind: file.kind } });
    try { await pipeline(Readable.from(buffer), upload); }
    catch (error) { await bucket.delete(upload.id).catch(() => {}); throw error; }
    return { _id: String(upload.id), ...file };
  },
  async claim(ids, thread, sender) {
    if (!ids.length) return [];
    const { files } = storage();
    const claimed = [];
    try {
      for (const id of ids) {
        const file = await files.findOneAndUpdate({ _id: oid(id), 'metadata.thread': oid(thread), 'metadata.sender': oid(sender), 'metadata.state': 'pending' }, { $set: { 'metadata.state': 'reserved' } }, { returnDocument: 'after' });
        if (!file) throw Object.assign(new Error('An attachment is unavailable or does not belong to this conversation.'), { status: 400 });
        claimed.push({ _id: String(file._id), name: file.filename, contentType: file.metadata.contentType, kind: file.metadata.kind, size: file.length });
      }
      return claimed;
    } catch (error) { await chatMediaStore.release(claimed.map((file) => file._id)); throw error; }
  },
  async publish(ids) {
    if (!ids.length) return;
    await storage().files.updateMany({ _id: { $in: ids.map(oid) }, 'metadata.state': 'reserved' }, { $set: { 'metadata.state': 'published' } });
  },
  async release(ids) {
    if (!ids.length) return;
    await storage().files.updateMany({ _id: { $in: ids.map(oid) }, 'metadata.state': 'reserved' }, { $set: { 'metadata.state': 'pending' } });
  },
  async get(id, thread) {
    return storage().files.findOne({ _id: oid(id), 'metadata.thread': oid(thread), 'metadata.state': { $in: ['published', 'reserved'] } });
  },
  open(id, range) {
    return storage().bucket.openDownloadStream(oid(id), range ? { start: range.start, end: range.end + 1 } : {});
  },
  async removePending(id, thread, sender) {
    const { files, bucket } = storage();
    const file = await files.findOneAndDelete({ _id: oid(id), 'metadata.thread': oid(thread), 'metadata.sender': oid(sender), 'metadata.state': 'pending' });
    if (!file) return false;
    await bucket.delete(file._id).catch((error) => { if (!/file not found/i.test(error.message)) throw error; });
    return true;
  },
  async deleteForThreads(ids) {
    if (!ids.length) return;
    const { files, bucket } = storage();
    // Keep each deletion scoped to the account's verified conversation IDs.
    const cursor = files.find({ 'metadata.thread': { $in: ids.map(oid) } });
    for await (const file of cursor) await bucket.delete(file._id);
  },
};
