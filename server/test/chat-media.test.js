import test from 'node:test';
import assert from 'node:assert/strict';
import { validateChatFile, validFileSignature, parseMediaRange } from '../src/utils/chatMedia.js';
import ChatMessage from '../src/models/ChatMessage.js';

const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
test('chat checks signatures for every allowed format and rejects disguised scripts', () => {
  const samples = [
    [png, 'image/png', 'evidence.png', 'image'],
    [Buffer.from([255, 216, 255, 224]), 'image/jpeg', 'photo.jpg', 'image'],
    [Buffer.from('RIFF0000WEBP0000'), 'image/webp', 'photo.webp', 'image'],
    [Buffer.from('GIF89a0000'), 'image/gif', 'image.gif', 'image'],
    [Buffer.from('0000ftypisom'), 'video/mp4', 'clip.mp4', 'video'],
    [Buffer.from([26, 69, 223, 163, 1]), 'video/webm', 'clip.webm', 'video'],
    [Buffer.from('ID3recording'), 'audio/mpeg', 'audio.mp3', 'audio'],
    [Buffer.from('RIFF0000WAVE0000'), 'audio/wav', 'audio.wav', 'audio'],
    [Buffer.from('%PDF-1.7\n'), 'application/pdf', 'receipt.pdf', 'file'],
    [Buffer.from('Evidence: suspicious SMS\n'), 'text/plain', 'notes.txt', 'file'],
  ];
  for (const [buffer, mime, name, kind] of samples) {
    assert.equal(validateChatFile(buffer, mime, name).kind, kind);
    if (mime !== 'text/plain') assert.equal(validFileSignature(Buffer.from('<script>alert(1)</script>'), mime), false);
  }
  assert.equal(validFileSignature(Buffer.from([0, 255]), 'text/plain'), false);
});
test('filenames are normalized and size, extension and empty-file limits are enforced', () => {
  assert.equal(validateChatFile(png, 'image/png', 'C:\\fakepath\\photo.png').name, 'photo.png');
  assert.equal(validateChatFile(png, 'image/png', '../../photo.png').name, 'photo.png');
  assert.equal(validateChatFile(png, 'IMAGE/PNG; charset=binary', 'photo.PNG').contentType, 'image/png');
  for (const [buffer, mime, name, status] of [
    [Buffer.alloc(0), 'image/png', 'empty.png', 400],
    [png, 'image/png', 'file.exe', 415],
    [png, 'text/html', 'file.html', 415],
    [Buffer.alloc(5 * 1024 * 1024 + 1), 'image/png', 'big.png', 413],
    [Buffer.alloc(10 * 1024 * 1024 + 1), 'application/pdf', 'big.pdf', 413],
    [Buffer.alloc(25 * 1024 * 1024 + 1), 'video/mp4', 'big.mp4', 413],
  ]) assert.throws(() => validateChatFile(buffer, mime, name), (error) => error.status === status);
});
test('media ranges support seeking and suffix downloads, without accepting invalid or multiple ranges', () => {
  assert.equal(parseMediaRange(undefined, 100), null);
  assert.deepEqual(parseMediaRange('bytes=0-9', 100), { start: 0, end: 9 });
  assert.deepEqual(parseMediaRange('bytes=90-', 100), { start: 90, end: 99 });
  assert.deepEqual(parseMediaRange('bytes=-10', 100), { start: 90, end: 99 });
  assert.deepEqual(parseMediaRange('bytes=-200', 100), { start: 0, end: 99 });
  assert.deepEqual(parseMediaRange('bytes=95-200', 100), { start: 95, end: 99 });
  for (const range of ['bytes=', 'bytes=-0', 'bytes=100-', 'bytes=10-5', 'bytes=0-1,3-4', 'units=0-9', 'bytes=9007199254740992-']) assert.deepEqual(parseMediaRange(range, 100), { invalid: true });
});
test('message schema accepts text or attachments but never an empty message or more than three files', () => {
  const member = { thread: '720000000000000000000001', sender: '710000000000000000000001', senderName: 'Member', senderRole: 'user' };
  const attachment = { _id: '770000000000000000000001', name: 'photo.png', contentType: 'image/png', kind: 'image', size: png.length };
  assert.equal(new ChatMessage({ ...member, body: 'Hello Staff' }).validateSync(), undefined);
  assert.equal(new ChatMessage({ ...member, attachments: [attachment] }).validateSync(), undefined);
  assert.ok(new ChatMessage(member).validateSync()?.errors.body);
  assert.ok(new ChatMessage({ ...member, attachments: Array(4).fill(attachment) }).validateSync()?.errors.attachments);
});
