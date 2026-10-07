// Inspect PNG dimensions before passing compressed bytes to an image decoder.
function wardrobePhotoBytes(value) {
  if (typeof value !== 'string' || value.length > 6_000_000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('Choose a valid PNG photo under 4 MB.');
  const bytes = Buffer.from(value.slice('data:image/png;base64,'.length), 'base64');
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || bytes.toString('ascii',12,16) !== 'IHDR') throw new Error('Photo could not open. Choose a valid PNG.');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  if (!width || !height || width>1024 || height>1024) throw new Error('Photo must be at most 1024 pixels per side.');
  return bytes;
}
module.exports = { wardrobePhotoBytes };
