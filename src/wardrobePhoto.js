// Bounded CPU work when editing a photo; never runs in the camera render loop.
export function cutoutPhoto(source, { removeBackground = true, tolerance = 35 } = {}) {
  const width = source.width, height = source.height;
  const data = new Uint8ClampedArray(source.data);
  if (!width || !height || width * height > 1024 * 1024 || data.length !== width * height * 4) throw new Error('Choose a smaller photo.');
  if (removeBackground) {
    const corners = [0, width - 1, (height - 1) * width, width * height - 1];
    const color = [0, 1, 2].map(c => corners.reduce((sum, p) => sum + data[p * 4 + c], 0) / 4);
    if (corners.some(p => color.some((v, c) => Math.abs(data[p * 4 + c] - v) > 35))) throw new Error('Use a plain background, or turn off Remove background and upload a cutout PNG.');
    const queue = new Uint32Array(width * height), visited = new Uint8Array(width * height);
    let read = 0, write = 0;
    const visit = p => {
      if (visited[p]) return;
      visited[p] = 1;
      if (data[p * 4 + 3] > 16 && color.some((v, c) => Math.abs(data[p * 4 + c] - v) > tolerance)) return;
      queue[write++] = p;
    };
    for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
    for (let y = 1; y < height - 1; y++) { visit(y * width); visit(y * width + width - 1); }
    while (read < write) {
      const p = queue[read++]; data[p * 4 + 3] = 0;
      if (p % width) visit(p - 1);
      if (p % width < width - 1) visit(p + 1);
      if (p >= width) visit(p - width);
      if (p + width < width * height) visit(p + width);
    }
  }
  let left = width, top = height, right = -1, bottom = -1, visible = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] <= 16) continue;
    visible++; left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (visible < width * height * .03) throw new Error('The garment disappeared. Lower the cutout strength or use a contrasting background.');
  return { data, width, height, bounds: { left, top, width: right - left + 1, height: bottom - top + 1 } };
}

export class WardrobePhoto {
  constructor({ video, onSave, onNotice = () => {}, onStopVoice = () => {}, ensureCamera = async () => false, suggestName = category => `My ${category}` }) {
    this.video = video; this.onSave = onSave; this.onNotice = onNotice; this.generation = 0; this.onStopVoice = onStopVoice; this.suggestName = suggestName; this.ensureCamera = ensureCamera;
    this.dialog = document.createElement('dialog'); this.dialog.id = 'wardrobe-photo';
    this.dialog.innerHTML = `<form method="dialog"><header><h2>Add to your wardrobe</h2><button type="button" data-action="close" aria-label="Close photo editor">✕</button></header>
      <div class="wardrobe-voice"><button type="button" data-voice-control="listen">Listen</button><button type="button" data-voice-control="stop">Stop voice</button><button type="button" data-voice-control="mute" aria-pressed="false">Mute microphone</button></div>
      <div class="wardrobe-caption-host"></div>
      <p>Lay one garment flat or hang it against a plain, contrasting background. Keep sleeves spread and the whole garment visible.</p>
      <div class="wardrobe-photo-actions"><button type="button" data-action="upload">Upload photo</button><button type="button" data-action="capture">Take photo</button><button type="button" data-action="phone">From phone</button></div><div data-field="phone" hidden><img alt="Scan to send a clothing photo" width="180" height="180"><p>Scan on the same Wi-Fi, choose a clothing photo, then review it here.</p></div>
      <input data-field="file" type="file" accept="image/png,image/jpeg,image/webp" hidden>
      <canvas width="480" height="540" aria-label="Garment cutout preview"></canvas>
      <label>Name <input data-field="name" maxlength="80" placeholder="My blue summer dress"></label>
      <label>Clothing type <select data-field="category"><option value="top">Top / T-shirt</option><option value="outerwear">Jacket / coat</option><option value="dress">Dress</option><option value="skirt">Skirt</option><option value="bottoms">Trousers</option></select></label>
      <label class="wardrobe-check"><input data-field="remove" type="checkbox" checked> Remove plain background</label>
      <label>Cutout strength <input data-field="tolerance" type="range" min="8" max="80" value="35"></label>
      <p data-field="status" role="status">Upload a photo, or turn on the mirror camera and say “take photo”.</p>
      <p class="wardrobe-help">Say “name it …”, “type dress”, “save garment”, or “cancel photo”. Swipe to choose a type; pinch to take a photo, then save. Use From phone to scan a QR and upload over Wi-Fi. A photo gives a front view, not a full 3D scan.</p>
      <button type="button" data-action="save" disabled>Save garment</button></form>`;
    document.body.append(this.dialog);
    this.field = name => this.dialog.querySelector(`[data-field="${name}"]`);
    this.button = name => this.dialog.querySelector(`[data-action="${name}"]`);
    this.canvas = this.dialog.querySelector('canvas');
    this.captionHost = this.dialog.querySelector('.wardrobe-caption-host');
    this.voiceButton = name => this.dialog.querySelector(`[data-voice-control="${name}"]`);
    this.voiceButton('listen').onclick = () => document.querySelector('#mic-btn')?.click();
    this.voiceButton('stop').onclick = () => this.onStopVoice();
    this.voiceButton('mute').onclick = () => document.querySelector('#mute-btn')?.click();

    this.button('close').onclick = () => this.close();
    this.button('upload').onclick = () => this.field('file').click();
    this.button('capture').onclick = () => this.capture();
    this.button('phone').onclick = () => void this.connectPhone();
    this.removePhoneListener = window.mirrorBridge?.onWardrobePhoto?.(value => void this.receivePhone(value));
    this.button('save').onclick = () => void this.save();
    this.field('name').oninput = () => { this.nameAutomatic = false; };
    this.field('category').onchange = () => this.updateSuggestedName();
    this.field('file').onchange = () => void this.upload(this.field('file').files?.[0]);
    for (const name of ['remove', 'tolerance']) this.field(name).oninput = () => this.preview();
    this.dialog.addEventListener('close', () => { if (this.open) return; this.restoreVoiceUi(); this.generation++; this.source = null; this.output = null; this.original = null; this.waitingPhone = false; void window.mirrorBridge?.wardrobePhone?.(false); });
    this.dialog.addEventListener('cancel', event => { if (this.saving) event.preventDefault(); });
    this.dialog.querySelector('form').onsubmit = event => { event.preventDefault(); void this.save(); };
  }
  get open() { return this.dialog.open; }
  get capturePending() { return this.captureOwner === this.generation; }
  show() {
    if (this.open) return;
    this.generation++; this.source = null; this.output = null;
    this.field('phone').hidden = true;
    this.nameAutomatic = true;
    this.field('name').value = ''; this.field('file').value = ''; this.field('remove').checked = true;
    this.field('tolerance').value = '35'; this.field('category').value = 'top';
    this.canvas.getContext('2d').clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.button('capture').disabled = false;
    this.button('save').disabled = true; this.status('Upload a photo, or hold the garment in front of the camera and take a photo.');
    this.attachVoiceUi();
    this.dialog.showModal(); this.button('upload').focus();
  }
  attachVoiceUi() {
    const captions = document.querySelector('#live-captions');
    if (captions && captions.parentNode !== this.captionHost) {
      this.captionHome = { parent: captions.parentNode, next: captions.nextSibling };
      this.captionHost.append(captions);
    }
    const mic = document.querySelector('#mic-btn'), mute = document.querySelector('#mute-btn');
    const sync = () => {
      const muted = mute?.getAttribute('aria-pressed') === 'true';
      this.voiceButton('listen').disabled = muted;
      this.voiceButton('listen').textContent = mic?.classList.contains('listening') ? 'Stop listening' : 'Start listening';
      this.voiceButton('mute').textContent = muted ? 'Unmute microphone' : 'Mute microphone';
      this.voiceButton('mute').setAttribute('aria-pressed', String(muted));
    };
    this.voiceObserver?.disconnect(); this.voiceObserver = new MutationObserver(sync);
    for (const node of [mic, mute]) if (node) this.voiceObserver.observe(node, { attributes: true, attributeFilter: ['class', 'aria-pressed'] });
    sync();
  }
  restoreVoiceUi() {
    this.voiceObserver?.disconnect();
    const captions = this.captionHost.querySelector('#live-captions');
    if (captions && this.captionHome) {
      const { parent, next } = this.captionHome;
      parent.insertBefore(captions, next?.parentNode === parent ? next : null);
    }
    this.captionHome = null;
  }
  close() { if (!this.saving) this.dialog.close(); }
  status(message) { this.field('status').textContent = message; }
  async connectPhone() {
    const generation = this.generation;
    try {
      if (!window.mirrorBridge?.wardrobePhone) throw new Error('Phone upload is available in the desktop app.');
      const pairing = await window.mirrorBridge.wardrobePhone(true);
      if (!this.open || generation !== this.generation) { void window.mirrorBridge.wardrobePhone(false); return; }
      this.waitingPhone = true; this.field('phone').hidden = false;
      this.field('phone').querySelector('img').src = pairing.qrDataUrl;
      this.status('Scan with your phone and send one clothing photo. It stays on your local network until you save it here.');
    } catch (error) { this.status(error.message); }
  }
  async receivePhone(value) {
    if (!this.open || this.saving || !this.waitingPhone) return;
    this.waitingPhone = false; this.field('phone').hidden = true;
    const generation = ++this.generation;
    try {
      const image = new Image(); image.src = value; await image.decode();
      if (generation !== this.generation || !this.open) return;
      this.setSource(image, image.naturalWidth, image.naturalHeight);
      this.status('Photo received. Check that only the garment remains, then name it and save.');
    } catch { this.status('Phone photo could not open. Try again.'); }
  }
  async upload(file) {
    if (!file || this.saving) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 20_000_000) { this.status('Choose a PNG, JPG, or WebP under 20 MB.'); return; }
    const hadName = Boolean(this.field('name').value.trim());
    const generation = ++this.generation, url = URL.createObjectURL(file);
    this.source = null; this.output = null; this.original = null;
    this.canvas.getContext('2d').clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.button('save').disabled = true;
    try {
      const image = new Image(); image.src = url; await image.decode();
      if (generation !== this.generation || !this.open) return;
      this.setSource(image, image.naturalWidth, image.naturalHeight);
      if (!hadName) { this.field('name').value = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 80); this.nameAutomatic = false; }
    } catch { if (generation === this.generation) this.status('This photo could not open. Choose another image.'); }
    finally { URL.revokeObjectURL(url); }
  }
  async capture() {
    if (this.saving || this.capturePending || !this.open) return;
    const generation = ++this.generation;
    this.captureOwner = generation; this.button('capture').disabled = true; this.button('save').disabled = true;
    try {
      if (!this.video?.srcObject || this.video.srcObject.active === false || this.video.readyState < 2 || !this.video.videoWidth) {
        this.status('Starting the mirror camera…');
        if (!await this.ensureCamera()) throw new Error('Camera unavailable. Connect a camera, or upload a photo.');
      }
      if (generation !== this.generation || !this.open) return;
      if (!this.video?.srcObject || this.video.srcObject.active === false || this.video.readyState < 2 || !this.video.videoWidth) throw new Error('Camera unavailable. Upload a photo instead.');
      this.setSource(this.video, this.video.videoWidth, this.video.videoHeight);
    } catch (error) { if (generation === this.generation && this.open) this.status(error.message); }
    finally { if (this.captureOwner === generation) { this.captureOwner = null; this.button('capture').disabled = this.saving; this.button('save').disabled = this.saving || !this.output; } }
  }
  updateSuggestedName() {
    if (this.nameAutomatic || !this.field('name').value.trim()) { this.field('name').value = this.suggestName(this.field('category').value); this.nameAutomatic = true; }
  }
  setSource(image, width, height) {
    this.updateSuggestedName();
    this.waitingPhone = false; this.field('phone').hidden = true; void window.mirrorBridge?.wardrobePhone?.(false);
    const scale = Math.min(1, 1024 / Math.max(width, height)), canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    this.source = ctx.getImageData(0, 0, canvas.width, canvas.height); this.original = canvas.toDataURL('image/png');
    let transparent = 0; for (let i = 3; i < this.source.data.length; i += 4) if (this.source.data[i] < 16) transparent++;
    this.field('remove').checked = transparent / (canvas.width * canvas.height) < .005;
    this.preview();
  }
  preview() {
    this.output = null; this.button('save').disabled = true;
    if (!this.source) return;
    try {
      const result = cutoutPhoto(this.source, { removeBackground: this.field('remove').checked, tolerance: Number(this.field('tolerance').value) });
      const temp = document.createElement('canvas'); temp.width = result.width; temp.height = result.height;
      temp.getContext('2d').putImageData(new ImageData(result.data, result.width, result.height), 0, 0);
      const crop = document.createElement('canvas'); crop.width = result.bounds.width; crop.height = result.bounds.height;
      crop.getContext('2d').drawImage(temp, result.bounds.left, result.bounds.top, crop.width, crop.height, 0, 0, crop.width, crop.height);
      this.output = crop.toDataURL('image/png');
      const ctx = this.canvas.getContext('2d'); ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      const scale = Math.min((this.canvas.width - 32) / crop.width, (this.canvas.height - 32) / crop.height);
      ctx.drawImage(crop, (this.canvas.width - crop.width * scale) / 2, (this.canvas.height - crop.height * scale) / 2, crop.width * scale, crop.height * scale);
      this.button('save').disabled = this.saving || this.capturePending;
      this.status('Check that only the garment remains, with no person or hanger. Choose a name and type, then save. For complex backgrounds, upload a transparent PNG.');
    } catch (error) { this.canvas.getContext('2d').clearRect(0, 0, this.canvas.width, this.canvas.height); this.status(error.message); }
  }
  async save() {
    if (this.saving || this.capturePending || !this.output || !this.open) return;
    const name = this.field('name').value.trim(); if (!name) { this.status('Give this garment a name.'); this.field('name').focus(); return; }
    this.saving = true; this.button('save').disabled = true;
    for (const el of this.dialog.querySelectorAll('input,select,button:not([data-voice-control])')) el.disabled = true;
    this.status('Saving on this device…');
    try {
      await this.onSave({ name, category: this.field('category').value, imageDataUrl: this.output, originalDataUrl: this.original });
      this.saving = false; this.dialog.close(); this.onNotice(`${name} saved locally.`);
    } catch (error) { this.status(`Could not save: ${error.message}`); }
    finally { this.saving = false; for (const el of this.dialog.querySelectorAll('input,select,button:not([data-voice-control])')) el.disabled = false; this.button('save').disabled = !this.output; }
  }
  voice(text) {
    if (!this.open) return false;
    const name = text.match(/^name (?:it|this|the garment)\s+(.+)/i), type = text.match(/^(?:type|category|make it (?:a|an))\s+(top|t shirt|t-shirt|jacket|coat|dress|skirt|trousers|pants)$/i);
    if (name && !this.saving) { this.nameAutomatic = false; this.field('name').value = name[1].trim().slice(0, 80); this.status(`Named ${this.field('name').value}.`); }
    else if (type && !this.saving) { this.field('category').value = { jacket: 'outerwear', coat: 'outerwear', pants: 'bottoms', trousers: 'bottoms', 't shirt': 'top', 't-shirt': 'top' }[type[1].toLowerCase()] || type[1].toLowerCase(); this.updateSuggestedName(); }
    else if (/^(?:from phone|connect phone|upload from phone)$/i.test(text)) void this.connectPhone();
    else if (/^(?:take|capture)(?: a)? photo$/i.test(text)) this.capture();
    else if (/^save(?: (?:garment|photo|it))?$/i.test(text)) void this.save();
    else if (/^(?:cancel|close)(?: photo|garment)?$/i.test(text)) this.close();
    else return false;
    return true;
  }
  gesture(type) {
    if (!this.open) return false;
    if (this.saving || this.capturePending) return true;
    if (type === 'pinch') { if (this.output) void this.save(); else this.capture(); }
    else if (['swipe-left', 'swipe-right'].includes(type)) {
      const select = this.field('category'), count = select.options.length;
      select.selectedIndex = (select.selectedIndex + (type === 'swipe-left' ? 1 : -1) + count) % count;
      this.updateSuggestedName();
      this.status(`Type: ${select.options[select.selectedIndex].text}. Pinch to ${this.output ? 'save' : 'take a photo'}.`);
    }
    return true;
  }
}
