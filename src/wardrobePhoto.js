import { photoSourceDimensions, photoSourceDataUrl, photoBlobDataUrl, photoBlobBytes, photoDecodedImage } from './photoSourceValidation.mjs';
import { enhanceCameraPixels } from './cameraClarity.js';
// Bounded CPU work when editing a photo; never runs in the camera render loop.
export function cutoutPhoto(source, { removeBackground = true, tolerance = 35, topPercent = 0, bottomPercent = 100 } = {}) {
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
  if (!Number.isFinite(topPercent) || !Number.isFinite(bottomPercent) || topPercent < 0 || bottomPercent > 100 || bottomPercent - topPercent < 5) throw new Error('Keep at least 5% of the photo between its top and bottom edges.');
  for (let y = 0; y < height; y++) if (y < height * topPercent / 100 || y >= height * bottomPercent / 100) for (let x = 0; x < width; x++) data[(y * width + x) * 4 + 3] = 0;
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
      <div class="wardrobe-photo-actions"><button type="button" data-action="front" aria-pressed="true">Front</button><button type="button" data-action="back" aria-pressed="false">Back (optional)</button><button type="button" data-action="remove-back" hidden>Remove back</button></div>
      <p>Lay one garment flat or hang it against a plain, contrasting background. Spread sleeves away from the body and keep the whole garment visible.</p>
      <div class="wardrobe-photo-actions"><button type="button" data-action="upload">Upload photo</button><button type="button" data-action="capture">Take photo</button><button type="button" data-action="phone">From phone</button></div><div data-field="phone" hidden><img alt="Scan to send a clothing photo" width="180" height="180"><p>Scan on the same Wi-Fi, choose a clothing photo, then review it here.</p></div>
      <div class="wardrobe-photo-actions"><button type="button" data-action="extract" disabled>Extract worn clothing</button><button type="button" data-action="restore" disabled>Restore photo</button></div>
      <input data-field="file" type="file" accept="image/png,image/jpeg,image/webp" hidden>
      <canvas width="480" height="540" aria-label="Garment cutout preview"></canvas>
      <label>Name <input data-field="name" maxlength="80" placeholder="My blue summer dress"></label>
      <label>Clothing type <select data-field="category"><option value="top">Top / T-shirt</option><option value="outerwear">Jacket / coat</option><option value="dress">Dress</option><option value="skirt">Skirt</option><option value="bottoms">Trousers</option></select></label>
      <label>Photo clarity <select data-field="clarity"><option value="off">Original</option><option value="natural">Natural · gentle clarity</option><option value="bright">Bright · lift shadows</option></select></label>
      <p>Original photo is retained. Bright changes apparent colors. Say “enhance photo”, “brighten photo”, or “original photo”.</p>
      <details class="wardrobe-refine"><summary>Adjust cutout</summary>
      <label class="wardrobe-check"><input data-field="remove" type="checkbox" checked> Remove plain background</label>
      <label>Cutout strength <input data-field="tolerance" type="range" min="8" max="80" value="35"></label>
      <label>Top edge <input data-field="crop-top" type="range" min="0" max="95" value="0"></label>
      <label>Bottom edge <input data-field="crop-bottom" type="range" min="5" max="100" value="100"></label>
      </details>
      <p data-field="status" role="status">Upload a photo, or turn on the mirror camera and say “take photo”.</p>
      <p class="wardrobe-help">Say “name it …”, “type dress”, “save garment”, or “cancel photo”. Swipe to choose a type; pinch to take a photo, then save. Say “add back photo” to add the other side, “show front photo” to review the front, or “remove back photo”. Swipe up/down switches front/back when no worn-clothing extraction is active. Use From phone to scan a QR and upload over Wi-Fi. For a photo worn by someone, say “extract clothing” with just one garment visible. Say “trim bottom” or “extend bottom” to exclude other clothes; swipe up/down does the same after extraction. Review the cutout before saving. A photo gives a front view, not a full 3D scan.</p>
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

    this.views = {}; this.activeView = 'front';
    this.button('front').onclick = () => this.switchView('front');
    this.button('back').onclick = () => this.switchView('back');
    this.button('remove-back').onclick = () => { this.views.back = null; if (this.activeView === 'back') { this.clearPhoto(); this.syncViews(); } else this.syncViews(); };
    this.button('close').onclick = () => this.close();
    this.button('upload').onclick = () => this.field('file').click();
    this.button('capture').onclick = () => this.capture();
    this.button('phone').onclick = () => void this.connectPhone();
    this.removePhoneListener = window.mirrorBridge?.onWardrobePhoto?.(value => void this.receivePhone(value));
    this.button('save').onclick = () => void this.save();
    this.button('extract').onclick = () => void this.extractClothing();
    this.button('restore').onclick = () => {
      this.cancelPhotoRead();this.cancelExtraction(); this.generation++; this.captureOwner = null; this.loadingOwner = null;
      if (!this.source && this.views[this.activeView]?.source) { this.source = this.views[this.activeView].source; this.original = this.views[this.activeView].original; }
      this.field('clarity').value = 'off';
      this.clothingSource = null; this.field('crop-top').value = '0'; this.field('crop-bottom').value = '100'; this.field('remove').checked = true; this.button('capture').disabled = false; this.button('extract').disabled = !this.source; this.preview(); this.syncViews();
    };
    this.field('name').oninput = () => { this.nameAutomatic = false; };
    this.field('category').onchange = () => this.updateSuggestedName();
    this.field('file').onchange = () => void this.upload(this.field('file').files?.[0]);
    for (const name of ['remove', 'tolerance', 'crop-top', 'crop-bottom']) this.field(name).oninput = () => this.preview();
    this.field('clarity').onchange = () => {
      if (this.saving || this.extracting || this.photoLoading || this.capturePending) { this.field('clarity').value = this.views[this.activeView]?.clarity || 'off'; return; }
      this.preview();
    };
    this.dialog.addEventListener('close', () => { if (this.open) return;this.cancelWork(); this.restoreVoiceUi(); this.cancelPhotoRead();this.cancelExtraction(); this.clothingSource = null; this.generation++; this.source = null; this.output = null; this.original = null; this.views = {}; this.waitingPhone = false; void window.mirrorBridge?.wardrobePhone?.(false); });
    this.dialog.addEventListener('cancel', () => this.cancelWork());
    this.dialog.querySelector('form').onsubmit = event => { event.preventDefault(); void this.save(); };
  }
  get open() { return this.dialog.open; }
  get readyToSave() {
    const front = this.activeView === 'front' ? this.output : this.views?.front?.output;
    const back = this.activeView === 'back' ? { source: this.source, output: this.output } : this.views?.back;
    return Boolean(this.open && front && (!back?.source || back.output) && !this.saving && !this.capturePending && !this.extracting && !this.photoLoading);
  }
  get photoLoading() { return this.loadingOwner === this.generation; }
  get capturePending() { return this.captureOwner === this.generation; }
  show() {
    if (this.open) return;
    this.cancelPhotoRead();this.cancelExtraction(); this.clothingSource = null; this.generation++; this.source = null; this.output = null;
    this.views = {}; this.activeView = 'front'; this.editingId=null;this.original=null;this.dialog.querySelector('h2').textContent='Add to your wardrobe';this.syncViews();
    this.field('phone').hidden = true;
    this.nameAutomatic = true;
    this.field('name').value = ''; this.field('file').value = ''; this.field('remove').checked = true;
    this.field('crop-top').value = '0'; this.field('crop-bottom').value = '100';
    this.field('clarity').value = 'off';
    this.field('tolerance').value = '35'; this.field('category').value = 'top';
    this.canvas.getContext('2d').clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.button('capture').disabled = false; this.button('extract').disabled = true; this.button('restore').disabled = true;
    this.button('save').disabled = true; this.status('Upload a photo, or hold the garment in front of the camera and take a photo.');
    this.attachVoiceUi();
    this.dialog.showModal(); this.button('upload').focus();
  }
  async showSaved(item){
    if(this.open)return;
    this.show();const generation=this.generation;this.cancelPhotoRead();const controller=this.photoReadController=new AbortController();this.loadingOwner=generation;this.syncViews();
    this.status('Opening original photos…');
    try{
      const front=await window.mirrorBridge.readClosetOriginal(item.id,'front');
      if(generation!==this.generation||!this.open)return;
      const back=item.backImageUrl?await window.mirrorBridge.readClosetOriginal(item.id,'back'):null;
      if(generation!==this.generation||!this.open)return;
      // Decode both before changing drafts. A failed back cannot save a partial edit.
      const decode=async photo=>{if(!photo)return null;photoSourceDataUrl(photo.imageDataUrl);return photoDecodedImage(photo.imageDataUrl,controller.signal);};
      const frontImage=await decode(front),backImage=await decode(back);
      if(generation!==this.generation||!this.open)return;
      if(!frontImage)throw new Error('Original photo is unavailable. Upload it again.');
      this.field('name').value=item.name;this.nameAutomatic=false;this.field('category').value=item.category;
      this.setSource(frontImage,frontImage.naturalWidth,frontImage.naturalHeight,front.imageDataUrl);this.rememberView();
      if(backImage){this.activeView='back';this.setSource(backImage,backImage.naturalWidth,backImage.naturalHeight,back.imageDataUrl);this.rememberView();this.activeView='front';const saved=this.views.front;Object.assign(this,{source:saved.source,output:saved.output,original:saved.original,clothingSource:saved.clothingSource});this.field('remove').checked=saved.remove;this.field('clarity').value=saved.clarity;this.preview();}
      this.editingId=item.id;this.dialog.querySelector('h2').textContent='Edit garment photo';
      this.status(front.legacy||back?.legacy?'Earlier saved photos contain a smaller original. You can adjust it or upload a higher-resolution photo.':'Original photos reopened. Adjust the cutout, then save to update this garment. Cancel keeps the saved garment.');
    }catch(error){if(generation===this.generation&&this.open){this.editingId=null;this.source=null;this.output=null;this.views={};this.status(error.message);}}
    finally{if(this.photoReadController===controller)this.photoReadController=null;if(this.loadingOwner===generation)this.loadingOwner=null;if(this.open)this.syncViews();}
  }
  syncViews() {
    this.button('save').disabled = !this.readyToSave;
    for (const view of ['front','back']) { this.button(view).setAttribute('aria-pressed', String(this.activeView === view)); this.button(view).textContent = `${view === 'front' ? 'Front' : 'Back (optional)'}${this.views[view]?.output ? ' ✓' : ''}`; }
    this.button('remove-back').hidden = !(this.views.back?.source || (this.activeView === 'back' && this.source));
  }
  rememberView() {
    this.views[this.activeView] = { source: this.source, output: this.output, original: this.original, clothingSource: this.clothingSource,
      clarity: this.field('clarity').value, remove: this.field('remove').checked, tolerance: this.field('tolerance').value, top: this.field('crop-top').value, bottom: this.field('crop-bottom').value };
  }
  clearPhoto() {
    this.cancelPhotoRead();this.cancelExtraction(); this.generation++; this.source = null; this.output = null; this.original = null; this.clothingSource = null;
    this.field('file').value = ''; this.field('remove').checked = true; this.field('tolerance').value = '35'; this.field('crop-top').value = '0'; this.field('crop-bottom').value = '100';
    this.field('clarity').value = 'off';
    this.button('capture').disabled = false; this.button('extract').disabled = true; this.button('restore').disabled = true; this.button('save').disabled = !this.views.front?.output;
    this.waitingPhone = false; this.field('phone').hidden = true; void window.mirrorBridge?.wardrobePhone?.(false);
    this.canvas.getContext('2d').clearRect(0,0,this.canvas.width,this.canvas.height);
  }
  switchView(view) {
    if (!this.open || this.saving || !['front','back'].includes(view) || this.activeView === view) return;
    if (!this.photoLoading) this.rememberView(); this.clearPhoto(); this.activeView = view;
    const saved = this.views[view];
    if (saved?.source) {
      Object.assign(this, { source: saved.source, output: saved.output, original: saved.original, clothingSource: saved.clothingSource });
      this.field('remove').checked = saved.remove; this.field('tolerance').value = saved.tolerance; this.field('crop-top').value = saved.top; this.field('crop-bottom').value = saved.bottom;
      this.field('clarity').value = saved.clarity || 'off';
      this.button('extract').disabled = false; this.button('restore').disabled = false; this.preview();
    } else this.status(`Add the ${view} of this garment using upload, camera, or phone. ${view === 'back' ? 'The back photo is optional; save with the reviewed front, or add a back photo first.' : 'A reviewed front photo is required.'}`);
    this.syncViews();
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
  cancelPhotoRead(){this.photoReadController?.abort();this.photoReadController=null;}
  cancelWork(){
    if(!this.saving&&!this.photoLoading&&!this.capturePending&&!this.extracting&&!this.waitingPhone&&this.phoneOwner!==this.generation)return;
    const requestId=this.saveRequestId;this.saveRequestId=null;this.saving=false;
    this.cancelPhotoRead();this.cancelExtraction();this.generation++;this.captureOwner=null;this.loadingOwner=null;this.phoneOwner=null;
    this.waitingPhone=false;this.field('phone').hidden=true;void window.mirrorBridge?.wardrobePhone?.(false);
    if(requestId)void window.mirrorBridge?.cancelClosetPhoto?.(requestId)?.catch(()=>{});
    for(const el of this.dialog.querySelectorAll('input,select,button:not([data-voice-control])'))el.disabled=false;
    this.syncViews();if(this.open)this.status('Photo work stopped. Your draft is kept.');
  }
  close() { this.cancelWork();this.dialog.close(); }
  status(message) { this.field('status').textContent = message; }
  async connectPhone() {
    if(!this.open||this.saving)return;
    const generation = this.generation;this.phoneOwner=generation;
    try {
      if (!window.mirrorBridge?.wardrobePhone) throw new Error('Phone upload is available in the desktop app.');
      const pairing = await window.mirrorBridge.wardrobePhone(true);
      if (!this.open || generation !== this.generation) return;
      this.waitingPhone = true; this.field('phone').hidden = false;
      this.field('phone').querySelector('img').src = pairing.qrDataUrl;
      this.status('Scan with your phone and send one clothing photo. It stays on your local network until you save it here.');
    } catch (error) { if(generation===this.generation&&this.open)this.status(error.message); }
    finally{if(this.phoneOwner===generation)this.phoneOwner=null;}
  }
  async receivePhone(value) {
    if (!this.open || this.saving || !this.waitingPhone) return;
    this.waitingPhone = false; this.field('phone').hidden = true;
    this.cancelPhotoRead();const controller=this.photoReadController=new AbortController();
    const generation = ++this.generation; this.loadingOwner = generation; this.button('save').disabled = true;
    try {
      photoSourceDataUrl(value);
      const image = await photoDecodedImage(value,controller.signal);
      if (generation !== this.generation || !this.open) return;
      this.setSource(image, image.naturalWidth, image.naturalHeight, value);
      this.status('Photo received. Check that only the garment remains, then name it and save.');
    } catch { if (generation === this.generation) this.status('Phone photo could not open. Try again.'); }
    finally { if(this.photoReadController===controller)this.photoReadController=null; if (this.loadingOwner === generation) this.loadingOwner = null; if (generation === this.generation) this.syncViews(); }
  }
  async upload(file) {
    if (!file || this.saving || !this.open) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 20_000_000) { this.status('Choose a PNG, JPG, or WebP under 20 MB.'); return; }
    const hadName = Boolean(this.field('name').value.trim());
    this.cancelPhotoRead();const controller=this.photoReadController=new AbortController();
    this.cancelExtraction(); this.clothingSource = null;
    const generation = ++this.generation, url = URL.createObjectURL(file); this.loadingOwner = generation;
    this.source = null; this.output = null; this.original = null;
    this.canvas.getContext('2d').clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.button('save').disabled = true;
    try {
      photoSourceDimensions(new Uint8Array(await photoBlobBytes(file,controller.signal)), file.type);
      if (generation !== this.generation || !this.open) return;
      const original = await photoBlobDataUrl(file,controller.signal);
      if (generation !== this.generation || !this.open) return;
      const image = await photoDecodedImage(url,controller.signal);
      if (generation !== this.generation || !this.open) return;
      this.setSource(image, image.naturalWidth, image.naturalHeight, original);
      if (!hadName) { this.field('name').value = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 80); this.nameAutomatic = false; }
    } catch (error) { if (generation === this.generation && this.open) this.status(error.message || 'This photo could not open. Choose another image.'); }
    finally { if(this.photoReadController===controller)this.photoReadController=null; URL.revokeObjectURL(url); if (this.loadingOwner === generation) this.loadingOwner = null; if (generation === this.generation) this.syncViews(); }
  }
  async capture() {
    if (this.saving || this.capturePending || this.extracting || this.photoLoading || !this.open) return;
    this.cancelPhotoRead();const controller=this.photoReadController=new AbortController();
    const generation = ++this.generation;
    this.captureOwner = generation; this.button('capture').disabled = true; this.button('save').disabled = true;
    try {
      if (!this.video?.srcObject || this.video.srcObject.active === false || this.video.readyState < 2 || !this.video.videoWidth) {
        this.status('Starting the mirror camera…');
        if (!await this.ensureCamera()) throw new Error('Camera unavailable. Connect a camera, or upload a photo.');
      }
      if (generation !== this.generation || !this.open) return;
      if (!this.video?.srcObject || this.video.srcObject.active === false || this.video.readyState < 2 || !this.video.videoWidth) throw new Error('Camera unavailable. Upload a photo instead.');
      const width=this.video.videoWidth,height=this.video.videoHeight;
      if(width>8192||height>8192||width*height>24_000_000)throw new Error('Camera photo exceeds 24 megapixels. Choose a lower camera quality.');
      const capture=document.createElement('canvas');capture.width=width;capture.height=height;
      capture.getContext('2d').drawImage(this.video,0,0,width,height);
      const blob=await new Promise(resolve=>capture.toBlob(resolve,'image/jpeg',.95));
      if(!blob)throw new Error('Camera photo could not be captured.');
      if(blob.size>20_000_000)throw new Error('Camera photo exceeds 20 MB. Choose a lower camera quality.');
      const original=await photoBlobDataUrl(blob,controller.signal);
      if(generation!==this.generation||!this.open)return;
      // Preview and original use the same frozen camera frame.
      this.setSource(capture,width,height,original);capture.width=capture.height=1;
    } catch (error) { if (generation === this.generation && this.open) this.status(error.message); }
    finally { if(this.photoReadController===controller)this.photoReadController=null; if (this.captureOwner === generation) { this.captureOwner = null; if (generation === this.generation) { this.button('capture').disabled = this.saving; this.button('save').disabled = this.saving || !this.output; this.syncViews(); } } }
  }
  updateSuggestedName() {
    if (this.nameAutomatic || !this.field('name').value.trim()) { this.field('name').value = this.suggestName(this.field('category').value); this.nameAutomatic = true; }
  }
  setSource(image, width, height, original) {
    if(!original)throw new Error('Original photo is missing. Try uploading or capturing again.');
    this.cancelExtraction(); this.clothingSource = null;
    this.field('crop-top').value = '0'; this.field('crop-bottom').value = '100';
    this.updateSuggestedName();
    this.waitingPhone = false; this.field('phone').hidden = true; void window.mirrorBridge?.wardrobePhone?.(false);
    const scale = Math.min(1, 1024 / Math.max(width, height)), canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    this.source = ctx.getImageData(0, 0, canvas.width, canvas.height); this.original = original;
    let transparent = 0; for (let i = 3; i < this.source.data.length; i += 4) if (this.source.data[i] < 16) transparent++;
    this.field('remove').checked = transparent / (canvas.width * canvas.height) < .005;
    this.button('extract').disabled = false; this.button('restore').disabled = false;
    this.preview();
  }
  get extracting() { return this.extractionOwner === this.generation; }
  cancelExtraction() { this.extractionJob?.cancel(); this.extractionJob = null; this.extractionOwner = null; }
  async extractClothing() {
    if (!this.open || !this.source || this.saving || this.capturePending || this.extracting) return;
    const generation = this.generation; this.extractionOwner = generation;
    this.button('extract').disabled = true; this.button('save').disabled = true;
    this.status('Extracting clothing locally… Keep just one garment visible in the photo.');
    try {
      const { extractPhotoClothing } = await import('./photoClothing.js');
      if (!this.open || generation !== this.generation || !this.extracting) return;
      const job = extractPhotoClothing(this.source); this.extractionJob = job;
      const result = await job.promise;
      if (!this.open || generation !== this.generation || this.extractionJob !== job) return;
      this.clothingSource = result.source; this.field('remove').checked = false;
      this.extractionOwner = null; this.preview();
      this.status('Review the outline carefully. All visible clothing is included; skin and background are removed. Hidden fabric cannot be recovered. Restore photo to use a flat garment instead.');
    } catch (error) { if (this.open && generation === this.generation && this.extracting) this.status(error.message); }
    finally { if (generation === this.generation) { this.extractionOwner = null; this.extractionJob = null; this.button('extract').disabled = !this.source; this.button('save').disabled = !this.output || this.saving; this.syncViews(); } }
  }
  preview() {
    this.output = null; this.button('save').disabled = true;
    if (!this.source) return;
    try {
      const result = cutoutPhoto(this.clothingSource || this.source, { removeBackground: this.field('remove').checked, tolerance: Number(this.field('tolerance').value), topPercent: Number(this.field('crop-top').value), bottomPercent: Number(this.field('crop-bottom').value) });
      enhanceCameraPixels(result.data, result.width, result.height, this.field('clarity').value || 'off');
      const temp = document.createElement('canvas'); temp.width = result.width; temp.height = result.height;
      temp.getContext('2d').putImageData(new ImageData(result.data, result.width, result.height), 0, 0);
      const crop = document.createElement('canvas'); crop.width = result.bounds.width; crop.height = result.bounds.height;
      crop.getContext('2d').drawImage(temp, result.bounds.left, result.bounds.top, crop.width, crop.height, 0, 0, crop.width, crop.height);
      this.output = crop.toDataURL('image/png');
      const ctx = this.canvas.getContext('2d'); ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      const scale = Math.min((this.canvas.width - 32) / crop.width, (this.canvas.height - 32) / crop.height);
      ctx.drawImage(crop, (this.canvas.width - crop.width * scale) / 2, (this.canvas.height - crop.height * scale) / 2, crop.width * scale, crop.height * scale);
      this.button('save').disabled = this.saving || this.capturePending || this.extracting;
      this.rememberView(); this.syncViews();
      this.status('Check that only the garment remains, with no person or hanger. Choose a name and type, then save. Use the top and bottom edges to keep just one garment. For complex backgrounds, extract worn clothing or upload a transparent PNG.');
    } catch (error) { this.rememberView(); this.syncViews(); this.canvas.getContext('2d').clearRect(0, 0, this.canvas.width, this.canvas.height); this.status(error.message); }
  }
  async save() {
    if (this.saving || this.capturePending || this.extracting || this.photoLoading || !this.open) return;
    this.rememberView();
    const front = this.views.front, back = this.views.back;
    if (!front?.output) { this.status('Review a front photo before saving.'); return; }
    if (back?.source && !back.output) { this.status('Review the back cutout or remove the back photo before saving.'); return; }
    const name = this.field('name').value.trim(); if (!name) { this.status('Give this garment a name.'); this.field('name').focus(); return; }
    const generation=this.generation,requestId=crypto.randomUUID();this.saveRequestId=requestId;
    this.saving = true; this.button('save').disabled = true;
    for (const el of this.dialog.querySelectorAll('input,select,button:not([data-voice-control]):not([data-action=close])')) el.disabled = true;
    this.status('Saving on this device…');
    try {
      await this.onSave({ requestId,garmentId:this.editingId||undefined, name, category: this.field('category').value, imageDataUrl: front.output, originalDataUrl: front.original, backImageDataUrl: back?.output || undefined, backOriginalDataUrl: back?.output ? back.original : undefined });
      if(generation!==this.generation||this.saveRequestId!==requestId)return;
      this.saving = false; this.dialog.close(); this.onNotice(`${name} saved locally.`);
    } catch (error) { if(generation===this.generation&&this.open)this.status(`Could not save: ${error.message}`); }
    finally { if(this.saveRequestId!==requestId)return;this.saveRequestId=null;this.saving = false; for (const el of this.dialog.querySelectorAll('input,select,button:not([data-voice-control]):not([data-action=close])')) el.disabled = false; this.button('save').disabled = !this.views.front?.output; }
  }
  voice(text) {
    if (!this.open) return false;
    if (/^(?:enhance|brighten|original|restore original) photo[.!]?$/i.test(text.trim())) {
      if (!this.saving && !this.extracting && !this.photoLoading && !this.capturePending) {
        this.field('clarity').value = /brighten/i.test(text) ? 'bright' : /original/i.test(text) ? 'off' : 'natural'; this.preview();
      }
      return true;
    }
    if (/^(?:take|capture) (front|back) photo[.!]?$/i.test(text.trim())) { this.switchView(text.toLowerCase().includes('back') ? 'back' : 'front'); void this.capture(); return true; }
    if (/^(?:add|edit|show|switch to)(?: the)? (front|back)(?: photo| view)?[.!]?$/i.test(text.trim())) { this.switchView(text.toLowerCase().includes('back') ? 'back' : 'front'); return true; }
    if (/^remove back(?: photo)?[.!]?$/i.test(text.trim())) { this.button('remove-back').click(); return true; }
    if (/^(?:extract|isolate)(?: worn)? clothing[.!]?$/i.test(text.trim())) { void this.extractClothing(); return true; }
    if (/^(trim|extend) (top|bottom)[.!]?$/i.test(text.trim()) && !this.saving && !this.extracting) { const [, action, edge] = text.trim().match(/^(trim|extend) (top|bottom)/i); this.adjustCrop(edge.toLowerCase(), action.toLowerCase() === 'trim'); return true; }
    if (/^restore photo[.!]?$/i.test(text.trim())) { this.button('restore').click(); return true; }
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
  adjustCrop(edge, trim) {
    const field = this.field(`crop-${edge}`), top = Number(this.field('crop-top').value), bottom = Number(this.field('crop-bottom').value);
    field.value = String(edge === 'top' ? Math.max(0, Math.min(bottom - 5, top + (trim ? 5 : -5))) : Math.max(top + 5, Math.min(100, bottom + (trim ? -5 : 5))));
    this.preview();
  }
  gesture(type) {
    if (!this.open) return false;
    if (this.saving || this.capturePending || this.extracting) return true;
    if (this.clothingSource && ['swipe-up', 'swipe-down'].includes(type)) this.adjustCrop('bottom', type === 'swipe-up');
    else if (['swipe-up','swipe-down'].includes(type)) this.switchView(type === 'swipe-up' ? 'back' : 'front');
    else if (type === 'pinch') { if (this.output) void this.save(); else this.capture(); }
    else if (['swipe-left', 'swipe-right'].includes(type)) {
      const select = this.field('category'), count = select.options.length;
      select.selectedIndex = (select.selectedIndex + (type === 'swipe-left' ? 1 : -1) + count) % count;
      this.updateSuggestedName();
      this.status(`Type: ${select.options[select.selectedIndex].text}. Pinch to ${this.output ? 'save' : 'take a photo'}.`);
    }
    return true;
  }
}
