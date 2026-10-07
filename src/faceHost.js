const HEADS = Object.freeze({
  // V2 is an original, deliberately simplified avatar family: large face
  // planes, sculpted hair masses and matte materials. Do not pair it with the
  // older illustrative speaking frames—the mismatch is visibly uncanny.
  velora: { image: 'assets/personas/evil-queen-head-v3.png', speaking: 'assets/personas/evil-queen-head-v3-speaking.png', rounded: 'assets/personas/evil-queen-head-v3-o.png', mouth: '#3c0c1f', lip: '#6f1e39', lid: '#e4b39d', mouthY: .232, eyeY: .085, eyeX: .125 },
  // Keep the last coherent Snow performance live while the next host moves to
  // a real feature rig. The current raster experiment is retained as an asset
  // for art direction, but is deliberately not used as the speaking performer.
  solenne: { image: 'assets/personas/snow-head-v3.png', speaking: 'assets/personas/snow-head-v2-speaking.png', rounded: 'assets/personas/snow-head-v2-o.png', mouth: '#4a1820', lip: '#b84e58', lid: '#f0c0aa', mouthY: .22, eyeY: .015, eyeX: .132, proceduralMouth: false },
  rowan: { image: 'assets/personas/advit-head-reference.png', mouth: '#31140e', lip: '#7b3d37', lid: '#4a281e', mouthY: .247 }
});

// The host is deliberately a face cutout, not a conventional character avatar.
// It uses high-resolution head art and a small, deterministic expression layer
// so speech, blinks, and gaze remain live without ever exposing a neck or body.
export class FaceHost {
  constructor(host) {
    this.host = host;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'face-host-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d', { alpha: true });
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    this.persona = 'velora';
    this.image = new Image();
    this.speakingImage = new Image();
    this.roundedImage = new Image();
    this.ready = false;
    this.speakingReady = false;
    this.roundedReady = false;
    this.speakingPatch = null;
    this.roundedPatch = null;
    this.fallbackMouthPatch = null;
    this.viseme = 'rest';
    this.poseBlend = { AA: 0, O: 0 };
    this.performance = { turn: 0, nod: 0, lean: 0 };
    this.performanceSmooth = { turn: 0, nod: 0, lean: 0 };
    this.speech = 0;
    this.blendshapes = {};
    this.gaze = { x: 0, y: 0, confidence: 0 };
    this.viewer = { x: 0, y: 0 };
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.setPersona(this.persona);
  }

  setPersona(persona) {
    this.persona = HEADS[persona] ? persona : 'velora';
    this.ready = false;
    this.image = new Image();
    this.speakingImage = new Image();
    this.roundedImage = new Image();
    this.speakingReady = false;
    this.roundedReady = false;
    this.speakingPatch = null;
    this.roundedPatch = null;
    this.fallbackMouthPatch = null;
    this.poseBlend = { AA: 0, O: 0 };
    const neutral = this.image;
    this.image.onload = () => {
      if (this.image !== neutral) return;
      if (this.persona === 'rowan') this.fallbackMouthPatch = createMouthPatch(neutral, HEADS.rowan);
      this.ready = true;
      this.draw(0);
    };
    this.image.src = HEADS[this.persona].image;
    if (HEADS[this.persona].speaking) {
      const speaking = this.speakingImage;
      this.speakingImage.onload = () => { if (this.speakingImage !== speaking) return; this.speakingPatch = createMouthPatch(speaking, HEADS[this.persona]); this.speakingReady = true; };
      this.speakingImage.src = HEADS[this.persona].speaking;
    }
    if (HEADS[this.persona].rounded) {
      const rounded = this.roundedImage;
      this.roundedImage.onload = () => { if (this.roundedImage !== rounded) return; this.roundedPatch = createMouthPatch(rounded, HEADS[this.persona]); this.roundedReady = true; };
      this.roundedImage.src = HEADS[this.persona].rounded;
    }
  }

  setFace(blendshapes, gaze, speech, viewer = {}) {
    this.blendshapes = blendshapes || {};
    this.gaze = gaze || this.gaze;
    this.speech = Math.max(0, Math.min(1, speech || 0));
    this.viewer = viewer || this.viewer;
  }

  setViseme(viseme) { this.viseme = viseme || 'rest'; }

  setPerformance(performance = {}) {
    this.performance = {
      turn: Number(performance.turn) || 0,
      nod: Number(performance.nod) || 0,
      lean: Number(performance.lean) || 0
    };
  }

  resize() {
    // The source art is ~1.2K; retain it for close viewing on the TV while
    // keeping the host canvas bounded on high-density desktop previews.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = width;
    this.height = height;
  }

  update(elapsed) { this.draw(elapsed); }

  draw(elapsed) {
    const { ctx, width: w, height: h } = this;
    if (!ctx || !w || !h) return;
    ctx.clearRect(0, 0, w, h);
    if (!this.ready) return;
    const base = Math.min(w, h) * 1.03;
    // No idle bounce: a mirror host should feel poised. Performance values are
    // eased so glances and deliberate nods settle rather than vibrate.
    for (const key of ['turn', 'nod', 'lean']) this.performanceSmooth[key] += (this.performance[key] - this.performanceSmooth[key]) * .13;
    const bob = this.performanceSmooth.nod * h * .032;
    const gazeX = (this.gaze.x || 0) * (this.gaze.confidence || 0) * w * .006;
    const gazeY = (this.gaze.y || 0) * (this.gaze.confidence || 0) * h * .004;
    ctx.save();
    const turn = Math.max(-1, Math.min(1, this.performanceSmooth.turn));
    ctx.translate(w / 2 + gazeX + turn * base * .038, h / 2 + bob + gazeY);
    // Tiny physical response makes the cutout feel attached to the observer,
    // without exposing a body or turning it into a flat sliding sticker.
    ctx.rotate((this.viewer.x || 0) * -.026 + this.performanceSmooth.lean * .13);
    const jaw = Math.max(this.blendshapes.jawOpen || 0, this.speech);
    const targetAA = this.viseme === 'AA' || (this.viseme === 'rest' && jaw > .12) ? 1 : 0;
    const targetO = this.viseme === 'O' ? 1 : 0;
    // Ease between poses rather than hard-swapping frames. The assets are
    // matched renders, so this gives the lips a continuous, deliberate feel.
    this.poseBlend.AA += (targetAA - this.poseBlend.AA) * .2;
    this.poseBlend.O += (targetO - this.poseBlend.O) * .2;
    const aa = Math.max(0, Math.min(1, this.poseBlend.AA));
    const rounded = Math.max(0, Math.min(1 - aa, this.poseBlend.O));
    // Do not squeeze the face to fake a turn. Width distortion is more
    // distracting than a stable front-on pose; real turns belong to the GLB.
    ctx.drawImage(this.image, -base / 2, -base / 2, base, base);
    // Only the mouth region crossfades. Blending entire head renders changes
    // cheeks, eyes and hair simultaneously, which reads as a melting face.
    const spec = HEADS[this.persona];
    const mouthY = base * (spec.mouthY ?? .323);
    if ((this.speakingReady && aa > .015) || (this.roundedReady && rounded > .015)) {
      ctx.save();
      if (this.speakingPatch && aa > .015) {
        ctx.globalAlpha = aa;
        ctx.drawImage(this.speakingPatch, -base * .11, mouthY - base * .05, base * .22, base * .10);
      }
      if (this.roundedPatch && rounded > .015) {
        ctx.globalAlpha = rounded;
        ctx.drawImage(this.roundedPatch, -base * .11, mouthY - base * .05, base * .22, base * .10);
      }
      ctx.restore();
    }
    ctx.restore();

    // Face proportions are held across the three deliberately front-on head
    // assets. The overlays sit inside existing features, so resting frames
    // retain the full-resolution art rather than a drawn approximation.
    const cx = w * .5 + gazeX;
    const cy = h * .5 + bob + gazeY;
    // Blinks come from the camera puppet. Avoid a timer-driven full eyelid
    // overlay: it can freeze an otherwise beautiful still frame mid-blink.
    const lid = Math.max(this.blendshapes.eyeBlinkLeft || 0, this.blendshapes.eyeBlinkRight || 0);
    if (lid > .08) this.drawLids(ctx, cx, cy, base, lid);
    if (spec.proceduralMouth !== false && jaw > .055 && !this.speakingReady && !this.roundedReady) this.drawMouth(ctx, cx, cy, base, jaw);
    // The generated hosts already contain sculpted brows. Drawing a second
    // eyebrow layer on top produces a visible double-brow artifact; reserve
    // the procedural fallback for the unstyled reference host only.
    if (this.persona === 'rowan') this.drawBrows(ctx, cx, cy, base);
  }

  drawLids(ctx, cx, cy, size, amount) {
    const spec = HEADS[this.persona];
    const y = cy + size * (spec.eyeY ?? .06);
    const height = size * .040 * Math.min(1, amount);
    const halfWidth = size * .082;
    ctx.save();
    ctx.fillStyle = spec.lid;
    ctx.globalAlpha = Math.min(.96, amount * 1.08);
    for (const x of [cx - size * (spec.eyeX ?? .135), cx + size * (spec.eyeX ?? .135)]) {
      ctx.beginPath();
      // Match the eye's almond footprint; a small skin-colored ellipse located
      // at the actual landmarks reads as a closing lid rather than a sticker.
      ctx.ellipse(x, y, halfWidth, height, 0, 0, Math.PI * 2);
      ctx.fill();
      if (amount > .55) {
        ctx.globalAlpha = (amount - .55) * .7;
        ctx.strokeStyle = '#36232a'; ctx.lineWidth = Math.max(1, size * .006); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - halfWidth * .72, y); ctx.quadraticCurveTo(x, y + size * .009, x + halfWidth * .72, y); ctx.stroke();
        ctx.globalAlpha = Math.min(.96, amount * 1.08);
      }
    }
    ctx.restore();
  }

  drawMouth(ctx, cx, cy, size, amount) {
    const spec = HEADS[this.persona];
    if (this.fallbackMouthPatch) {
      // The reference already has detailed teeth and lips. Keep that painted
      // mouth as one soft-edged layer; an additional dark oval reads as a
      // second mouth, even when its center is correctly aligned.
      const stretch = 1 + Math.min(1, amount) * .28;
      ctx.drawImage(this.fallbackMouthPatch, cx - size * .11, cy + size * (spec.mouthY - .05), size * .22, size * .10 * stretch);
      return;
    }
    const round = Math.max(this.blendshapes.mouthFunnel || 0, this.blendshapes.mouthPucker || 0);
    const smile = Math.max(this.blendshapes.mouthSmileLeft || 0, this.blendshapes.mouthSmileRight || 0);
    // Keep the cavity comfortably inside the painted lips. A large dark oval
    // reads as a sticker on a clean emoji face; short, narrow openings preserve
    // the designed lip silhouette while still communicating speech.
    const openness = size * (.003 + amount * .018);
    const y = cy + size * (spec.mouthY ?? .323);
    ctx.save();
    ctx.fillStyle = spec.mouth;
    ctx.beginPath();
    ctx.ellipse(cx, y, size * (round > .25 ? .026 : .038 + amount * .003), openness, 0, 0, Math.PI * 2);
    ctx.fill();
    if (amount > .38) {
      ctx.fillStyle = 'rgba(255,191,191,.72)';
      ctx.beginPath();
      ctx.ellipse(cx, y + openness * .35, size * .028, openness * .18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawBrows(ctx, cx, cy, size) {
    const left = this.blendshapes.browInnerUp || 0;
    const right = this.blendshapes.browOuterUpRight || 0;
    const lift = Math.max(left, right);
    if (lift < .12) return;
    ctx.save();
    ctx.globalAlpha = Math.min(.28, lift * .3);
    ctx.strokeStyle = this.persona === 'rowan' ? '#25150f' : '#2a1622';
    ctx.lineWidth = Math.max(1.5, size * .009);
    ctx.lineCap = 'round';
    const y = cy + size * .012 - lift * size * .028;
    for (const direction of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + direction * size * .055, y + size * .014);
      ctx.quadraticCurveTo(cx + direction * size * .14, y - size * .026, cx + direction * size * .205, y + size * .006);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function createMouthPatch(image, spec) {
  // Blend only the lips and their immediate edge. A large hard ellipse exposed
  // the older speaking art's cheek/nose lighting as a conspicuous face patch.
  // The feathered crop is cached when the image loads, never per frame.
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const patch = document.createElement('canvas');
  patch.width = Math.ceil(width * .22);
  patch.height = Math.ceil(height * .10);
  const context = patch.getContext('2d');
  context.drawImage(image, width * .39, height * (.5 + spec.mouthY - .05), width * .22, height * .10,
    0, 0, patch.width, patch.height);
  context.globalCompositeOperation = 'destination-in';
  context.translate(patch.width / 2, patch.height / 2);
  context.scale(patch.width / 2, patch.height / 2);
  const mask = context.createRadialGradient(0, 0, 0, 0, 0, 1);
  mask.addColorStop(0, '#fff');
  mask.addColorStop(.68, '#fff');
  mask.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = mask;
  context.fillRect(-1, -1, 2, 2);
  return patch;
}
