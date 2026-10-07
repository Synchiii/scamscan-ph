import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Writable, Readable } from 'node:stream';
import mongoose from 'mongoose';
import { chatMediaStore } from '../src/services/chatMediaStore.js';

const account = '710000000000000000000001';
const otherAccount = '710000000000000000000002';
const thread = '720000000000000000000001';
const otherThread = '720000000000000000000002';
const first = '770000000000000000000001';
const second = '770000000000000000000002';
const oid = (value) => new mongoose.Types.ObjectId(value);
const originalBucket = Object.getOwnPropertyDescriptor(mongoose.mongo, 'GridFSBucket');
let priorDb, rows, deletedChunks, rangeOptions;
function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) => {
    const actual = key.split('.').reduce((object, field) => object?.[field], row);
    if (value?.$in) return value.$in.some((entry) => String(entry) === String(actual));
    if (value?.$lt) return actual < value.$lt;
    return String(actual) === String(value);
  });
}
function entry(id, owner = account, conversation = thread, state = 'pending') {
  return { _id: oid(id), filename: 'evidence.txt', length: 4, uploadDate: new Date(0), metadata: { sender: oid(owner), thread: oid(conversation), state, contentType: 'text/plain', kind: 'file' } };
}
beforeEach(() => {
  priorDb = mongoose.connection.db; rows = []; deletedChunks = []; rangeOptions = null;
  const files = {
    find: (filter) => {
      let limit = Infinity;
      const cursor = { limit: (count) => { limit = count; return cursor; }, toArray: async () => rows.filter((row) => matches(row, filter)).slice(0, limit), async *[Symbol.asyncIterator]() { yield* rows.filter((row) => matches(row, filter)); } };
      return cursor;
    },
    findOne: async (filter) => rows.find((row) => matches(row, filter)) || null,
    findOneAndUpdate: async (filter, update) => { const row = rows.find((row) => matches(row, filter)); if (row) row.metadata.state = update.$set['metadata.state']; return row || null; },
    updateMany: async (filter, update) => { rows.filter((row) => matches(row, filter)).forEach((row) => { row.metadata.state = update.$set['metadata.state']; }); },
    findOneAndDelete: async (filter) => { const index = rows.findIndex((row) => matches(row, filter)); return index < 0 ? null : rows.splice(index, 1)[0]; },
  };
  const bucket = {
    delete: async (id) => { deletedChunks.push(String(id)); const index = rows.findIndex((row) => String(row._id) === String(id)); if (index < 0) throw new Error('File not found for id ' + id); rows.splice(index, 1); },
    openUploadStream: (name, options) => {
      const chunks = [];
      const upload = new Writable({ write(chunk, _encoding, callback) { chunks.push(chunk); callback(); }, final(callback) { rows.push({ _id: upload.id, filename: name, length: Buffer.concat(chunks).length, buffer: Buffer.concat(chunks), metadata: options.metadata, uploadDate: new Date() }); callback(); } });
      upload.id = oid(first); return upload;
    },
    openDownloadStream: (_id, options) => { rangeOptions = options; return Readable.from(Buffer.from('data')); },
  };
  mongoose.connection.db = { collection: (name) => { assert.equal(name, 'chat_uploads.files'); return files; } };
  Object.defineProperty(mongoose.mongo, 'GridFSBucket', { configurable: true, writable: true, value: function (_db, options) { assert.equal(options.bucketName, 'chat_uploads'); return bucket; } });
});
afterEach(() => { mongoose.connection.db = priorDb; Object.defineProperty(mongoose.mongo, 'GridFSBucket', originalBucket); });

test('GridFS saves private bytes and cleans only the sender old unsent uploads', async () => {
  const old = '770000000000000000000099';
  rows = [entry(old), entry(second, otherAccount), entry('770000000000000000000098', account, thread, 'published')];
  const buffer = Buffer.from('evidence');
  const saved = await chatMediaStore.save(buffer, { name: 'notes.txt', contentType: 'text/plain', kind: 'file', size: buffer.length }, thread, account);
  assert.equal(saved._id, first); assert.deepEqual(deletedChunks, [old]);
  const stored = rows.find((row) => String(row._id) === first);
  assert.deepEqual(stored.buffer, buffer); assert.equal(stored.metadata.state, 'pending');
  assert.equal(String(stored.metadata.sender), account); assert.equal(String(stored.metadata.thread), thread);
  assert.equal(rows.length, 3);
});
test('GridFS claims only own pending files and releases a partial reservation on failure', async () => {
  rows = [entry(first), entry(second, otherAccount)];
  await assert.rejects(chatMediaStore.claim([first, second], thread, account), (error) => error.status === 400);
  assert.ok(rows.every((row) => row.metadata.state === 'pending'));
  const claimed = await chatMediaStore.claim([first], thread, account);
  assert.equal(claimed[0].name, 'evidence.txt'); assert.equal(rows[0].metadata.state, 'reserved');
  await chatMediaStore.publish([first]); assert.equal(rows[0].metadata.state, 'published');
  await assert.rejects(chatMediaStore.claim([first], thread, account), (error) => error.status === 400);
  assert.equal(await chatMediaStore.get(first, otherThread), null);
  assert.equal((await chatMediaStore.get(first, thread)).filename, 'evidence.txt');
});
test('GridFS unsent deletion is owner-scoped and removes orphan chunks after atomic reservation check', async () => {
  rows = [entry(first), entry(second, account, thread, 'published')];
  assert.equal(await chatMediaStore.removePending(first, thread, otherAccount), false);
  assert.equal(await chatMediaStore.removePending(second, thread, account), false);
  assert.equal(await chatMediaStore.removePending(first, thread, account), true);
  assert.deepEqual(deletedChunks, [first]); assert.equal(rows.length, 1);
});
test('GridFS account cleanup is conversation-scoped and video range ends are exclusive', async () => {
  rows = [entry(first), entry(second, otherAccount, otherThread)];
  await chatMediaStore.deleteForThreads([thread]);
  assert.deepEqual(rows.map((row) => String(row._id)), [second]);
  const stream = chatMediaStore.open(second, { start: 1, end: 3 });
  assert.deepEqual(rangeOptions, { start: 1, end: 4 }); stream.destroy();
  mongoose.connection.db = null;
  await chatMediaStore.deleteForThreads([]);
  await assert.rejects(chatMediaStore.get(second, thread), (error) => error.status === 503);
});
