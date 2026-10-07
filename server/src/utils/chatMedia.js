import path from 'node:path';

const MB = 1024 * 1024;
export const MAX_CHAT_UPLOAD_BYTES = 25 * MB;
export const chatFileTypes = {
  'image/png': { kind: 'image', max: 5 * MB, extensions: ['.png'] },
  'image/jpeg': { kind: 'image', max: 5 * MB, extensions: ['.jpg', '.jpeg'] },
  'image/webp': { kind: 'image', max: 5 * MB, extensions: ['.webp'] },
  'image/gif': { kind: 'image', max: 5 * MB, extensions: ['.gif'] },
  'video/mp4': { kind: 'video', max: 25 * MB, extensions: ['.mp4'] },
  'video/webm': { kind: 'video', max: 25 * MB, extensions: ['.webm'] },
  'audio/mpeg': { kind: 'audio', max: 10 * MB, extensions: ['.mp3'] },
  'audio/wav': { kind: 'audio', max: 10 * MB, extensions: ['.wav'] },
  'application/pdf': { kind: 'file', max: 10 * MB, extensions: ['.pdf'] },
  'text/plain': { kind: 'file', max: 10 * MB, extensions: ['.txt'] },
};
const starts = (buffer, bytes) => buffer.length >= bytes.length && bytes.every((value, index) => buffer[index] === value);
export function validFileSignature(buffer, mime) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return false;
  const ascii = (start, end) => buffer.subarray(start, end).toString('ascii');
  switch (mime) {
    case 'image/png': return starts(buffer, [137, 80, 78, 71, 13, 10, 26, 10]);
    case 'image/jpeg': return starts(buffer, [255, 216, 255]);
    case 'image/gif': return ['GIF87a', 'GIF89a'].includes(ascii(0, 6));
    case 'image/webp': return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
    case 'video/mp4': return buffer.length >= 12 && ascii(4, 8) === 'ftyp';
    case 'video/webm': return starts(buffer, [26, 69, 223, 163]);
    case 'audio/mpeg': return ascii(0, 3) === 'ID3' || (buffer[0] === 255 && (buffer[1] & 224) === 224);
    case 'audio/wav': return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE';
    case 'application/pdf': return ascii(0, 5) === '%PDF-';
    case 'text/plain':
      try { const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); return !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text); } catch { return false; }
    default: return false;
  }
}
export function validateChatFile(buffer, contentType, rawName) {
  const mime = String(contentType || '').split(';')[0].trim().toLowerCase();
  const config = chatFileTypes[mime];
  if (!config) throw Object.assign(new Error('Choose a PNG, JPG, WEBP, GIF, MP4, WEBM, MP3, WAV, PDF, or TXT file.'), { status: 415 });
  const name = path.posix.basename(path.win32.basename(String(rawName || 'file'))).replace(/[\x00-\x1f\x7f]/g, '').slice(-120);
  if (!config.extensions.includes(path.extname(name).toLowerCase())) throw Object.assign(new Error('The filename and file type do not match.'), { status: 415 });
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw Object.assign(new Error('The selected file is empty.'), { status: 400 });
  if (buffer.length > config.max) throw Object.assign(new Error('This file exceeds the ' + (config.max / MB) + ' MB limit.'), { status: 413 });
  if (!validFileSignature(buffer, mime)) throw Object.assign(new Error('The file content does not match its declared type.'), { status: 415 });
  return { name, contentType: mime, kind: config.kind, size: buffer.length };
}
export function parseMediaRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return { invalid: true };
  const suffix = !match[1];
  const first = Number(suffix ? match[2] : match[1]);
  const last = match[2] && !suffix ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first < 0 || (suffix && first === 0)) return { invalid: true };
  const start = suffix ? Math.max(0, size - first) : first;
  const end = suffix ? size - 1 : Math.min(last, size - 1);
  return start >= size || end < start ? { invalid: true } : { start, end };
}
