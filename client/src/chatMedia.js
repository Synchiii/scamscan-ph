const formats = {
  png: ['image/png', 'image', 5], jpg: ['image/jpeg', 'image', 5], jpeg: ['image/jpeg', 'image', 5], webp: ['image/webp', 'image', 5], gif: ['image/gif', 'image', 5],
  mp4: ['video/mp4', 'video', 25], webm: ['video/webm', 'video', 25], mp3: ['audio/mpeg', 'audio', 10], wav: ['audio/wav', 'audio', 10],
  pdf: ['application/pdf', 'file', 10], txt: ['text/plain', 'file', 10],
};
export const chatFileAccept = Object.keys(formats).map((extension) => '.' + extension).join(',');
export function describeChatFile(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  const format = formats[extension];
  if (!format) throw new Error('Choose an image, MP4/WEBM video, MP3/WAV audio, PDF, or TXT file.');
  if (!file.size) throw new Error('The selected file is empty.');
  if (file.size > format[2] * 1024 * 1024) throw new Error(file.name + ' exceeds the ' + format[2] + ' MB limit.');
  return { file, contentType: format[0], kind: format[1] };
}
export function formatFileSize(bytes) { return bytes >= 1024 * 1024 ? (bytes / (1024 * 1024)).toFixed(1) + ' MB' : Math.max(1, Math.ceil(bytes / 1024)) + ' KB'; }
