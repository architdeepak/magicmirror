export class AROverlay {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.effect = 'enchanted';
    this.faceTarget = null;
    this.resize();
  }

  setEffect(effect) { this.effect = effect; }

  resize() {
    const bounds = this.canvas.parentElement?.getBoundingClientRect();
    const width = Math.round(bounds?.width || window.innerWidth);
    const height = Math.round(bounds?.height || window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  clear() {
    const bounds = this.canvas.parentElement?.getBoundingClientRect();
    this.ctx.clearRect(0, 0, bounds?.width || window.innerWidth, bounds?.height || window.innerHeight);
  }

  // The cursor is normalized to the entire shell so every tray control can
  // be reached even on a portrait display. Face hit testing uses the same
  // camera-to-cover projection as the actual AR, rather than a stretched
  // camera image. Coordinates are shell-normalized, excluding letterboxing.
  containsFacePoint(point) {
    if (!this.faceTarget || !point) return false;
    const { cx, cy, rx, ry, width, height } = this.faceTarget;
    return ((point.x * width - cx) / rx) ** 2 + ((point.y * height - cy) / ry) ** 2 <= 1;
  }

  containsCameraFacePoint(point, video) {
    if (!point || !video) return false;
    const projected = project(point, video);
    const bounds = video.closest('#app-shell')?.getBoundingClientRect();
    return this.containsFacePoint({ x: projected.x / (bounds?.width || window.innerWidth), y: projected.y / (bounds?.height || window.innerHeight) });
  }

  renderDrag(effect, cursor, elapsed = 0, overFace = false) {
    if (!cursor || !effect || effect === 'none') return;
    const bounds = this.canvas.parentElement?.getBoundingClientRect();
    const width = bounds?.width || window.innerWidth;
    const height = bounds?.height || window.innerHeight;
    const x = cursor.x * width;
    const y = cursor.y * height;
    const size = Math.max(80, Math.min(150, width * .15));
    const leftEye = { x: x + size * .2, y };
    const rightEye = { x: x - size * .2, y };
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = .9;
    if (overFace && this.faceTarget) {
      const target = this.faceTarget;
      ctx.beginPath();
      ctx.ellipse(target.cx, target.cy, target.rx, target.ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#c5ffe0';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 7]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (effect === 'glasses') this._glasses(leftEye, rightEye, size, 0, elapsed);
    else if (effect === 'mask') this._mask(leftEye, rightEye, { x, y: y + size * .15 }, size, 0, elapsed);
    else if (effect === 'crown') this._crown({ x, y: y + size * .15 }, size, size, elapsed);
    else if (effect === 'halo') this._halo({ x, y: y + size * .25 }, size, size, 0, elapsed);
    else {
      ctx.beginPath();
      ctx.arc(x, y, size * .32, 0, Math.PI * 2);
      ctx.strokeStyle = '#c5ffe0';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
  }

  render(landmarks, video, elapsed, enabled) {
    this.clear();
    this.faceTarget = null;
    if (!enabled || !landmarks || !video?.videoWidth) return;
    const point = (index) => project(landmarks[index], video);
    const left = point(234);
    const right = point(454);
    const top = point(10);
    const chin = point(152);
    const leftEye = point(33);
    const rightEye = point(263);
    const nose = point(1);
    const mouthTop = point(13);
    const mouthBottom = point(14);
    const faceWidth = Math.abs(right.x - left.x);
    const faceHeight = Math.abs(chin.y - top.y);
    const centerX = (left.x + right.x) / 2;
    const centerY = (top.y + chin.y) / 2;
    // Mirroring reverses eye order. Sorting by screen X avoids rotating
    // glasses/masks through 180 degrees on every upright face.
    const eyeA = leftEye.x < rightEye.x ? leftEye : rightEye;
    const eyeB = leftEye.x < rightEye.x ? rightEye : leftEye;
    const roll = Math.atan2(eyeB.y - eyeA.y, eyeB.x - eyeA.x);
    const mouthOpen = Math.abs(mouthBottom.y - mouthTop.y) / Math.max(faceHeight, 1);
    const bounds = video.closest('#app-shell')?.getBoundingClientRect();
    this.faceTarget = { cx: centerX, cy: centerY, rx: Math.max(45, faceWidth * .75), ry: Math.max(60, faceHeight * .72), width: bounds?.width || window.innerWidth, height: bounds?.height || window.innerHeight };

    if (['crown', 'runes', 'aura', 'scan'].includes(this.effect)) this._faceContour(landmarks, video, elapsed);
    if (['crown', 'runes', 'aura'].includes(this.effect)) this._eyeGlow(leftEye, rightEye, faceWidth, elapsed);

    if (this.effect === 'enchanted') this._enchantedReveal(centerX, centerY, faceWidth, faceHeight, roll, elapsed);
    if (this.effect === 'crown') this._crown(top, faceWidth, faceHeight, elapsed);
    if (this.effect === 'runes') this._runes(centerX, centerY, faceWidth, elapsed);
    if (this.effect === 'aura') this._aura(centerX, centerY, faceWidth, faceHeight, elapsed);
    if (this.effect === 'glasses') this._glasses(leftEye, rightEye, faceWidth, roll, elapsed);
    if (this.effect === 'mask') this._mask(leftEye, rightEye, nose, faceWidth, roll, elapsed);
    if (this.effect === 'cat') this._cat(top, nose, left, right, faceWidth, faceHeight, roll, elapsed);
    if (this.effect === 'halo') this._halo(top, faceWidth, faceHeight, roll, elapsed);
    if (this.effect === 'emoji') this._emojiOrbit(centerX, centerY, faceWidth, faceHeight, elapsed, mouthOpen);
    if (this.effect === 'scan') this._scan(landmarks, video, centerX, centerY, faceWidth, faceHeight, elapsed);
  }

  _faceContour(landmarks, video, elapsed) {
    const contour = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    contour.forEach((index, i) => {
      const p = project(landmarks[index], video);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.strokeStyle = `rgba(190, 154, 255, ${0.2 + Math.sin(elapsed * 2) * 0.05})`;
    ctx.lineWidth = 1.2;
    ctx.shadowColor = '#a46cff';
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.restore();
  }

  _eyeGlow(left, right, faceWidth, elapsed) {
    const ctx = this.ctx;
    const radius = Math.max(3, faceWidth * 0.025);
    for (const eye of [left, right]) {
      const glow = ctx.createRadialGradient(eye.x, eye.y, 0, eye.x, eye.y, radius * 4);
      glow.addColorStop(0, 'rgba(247, 221, 139, .95)');
      glow.addColorStop(.2, 'rgba(215, 159, 255, .58)');
      glow.addColorStop(1, 'rgba(130, 62, 255, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(eye.x, eye.y, radius * (3.3 + Math.sin(elapsed * 3) * .25), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _crown(top, faceWidth, faceHeight, elapsed) {
    const ctx = this.ctx;
    const width = faceWidth * 1.08;
    const height = faceHeight * 0.4;
    const baseY = top.y - faceHeight * 0.06;
    const pulse = 1 + Math.sin(elapsed * 1.8) * 0.025;
    ctx.save();
    ctx.translate(top.x, baseY);
    ctx.scale(pulse, pulse);
    ctx.beginPath();
    ctx.moveTo(-width / 2, 0);
    ctx.lineTo(-width * .43, -height * .62);
    ctx.lineTo(-width * .2, -height * .3);
    ctx.lineTo(0, -height);
    ctx.lineTo(width * .2, -height * .3);
    ctx.lineTo(width * .43, -height * .62);
    ctx.lineTo(width / 2, 0);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, -height, 0, 0);
    gradient.addColorStop(0, 'rgba(247, 222, 145, .92)');
    gradient.addColorStop(1, 'rgba(128, 75, 176, .18)');
    ctx.fillStyle = gradient;
    ctx.strokeStyle = 'rgba(255, 229, 155, .9)';
    ctx.lineWidth = 1.2;
    ctx.shadowColor = '#cf9bff';
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  _runes(cx, cy, faceWidth, elapsed) {
    const glyphs = ['△', '◇', '☽', '✦', '⌁', '○'];
    const radius = faceWidth * 0.76;
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `${Math.max(13, faceWidth * .055)}px Cinzel`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(227, 198, 255, .78)';
    ctx.shadowColor = '#9d5cff';
    ctx.shadowBlur = 12;
    glyphs.forEach((glyph, i) => {
      const angle = elapsed * 0.16 + (i / glyphs.length) * Math.PI * 2;
      ctx.fillText(glyph, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius * 1.18);
    });
    ctx.restore();
  }

  _aura(cx, cy, faceWidth, faceHeight, elapsed) {
    const ctx = this.ctx;
    ctx.save();
    const glow = ctx.createRadialGradient(cx, cy, faceWidth * .2, cx, cy, faceWidth * 1.2);
    glow.addColorStop(0, 'rgba(157, 94, 255, 0)');
    glow.addColorStop(.62, 'rgba(157, 94, 255, .14)');
    glow.addColorStop(.82, `rgba(229, 193, 255, ${.17 + Math.sin(elapsed * 2) * .04})`);
    glow.addColorStop(1, 'rgba(90, 33, 155, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(cx, cy, faceWidth * 1.25, faceHeight * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _glasses(leftEye, rightEye, faceWidth, roll, elapsed) {
    const ctx = this.ctx;
    const cx = (leftEye.x + rightEye.x) / 2;
    const cy = (leftEye.y + rightEye.y) / 2;
    const lensWidth = faceWidth * .36;
    const lensHeight = lensWidth * .56;
    const eyeGap = Math.abs(rightEye.x - leftEye.x);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(roll);
    const gradient = ctx.createLinearGradient(0, -lensHeight, 0, lensHeight);
    gradient.addColorStop(0, 'rgba(151, 111, 255, .78)');
    gradient.addColorStop(.55, 'rgba(21, 12, 38, .9)');
    gradient.addColorStop(1, 'rgba(231, 199, 116, .38)');
    ctx.fillStyle = gradient;
    ctx.strokeStyle = 'rgba(244, 218, 148, .92)';
    ctx.lineWidth = Math.max(2, faceWidth * .012);
    ctx.shadowColor = '#9b6cff';
    ctx.shadowBlur = 14 + Math.sin(elapsed * 2) * 2;
    for (const x of [-eyeGap / 2, eyeGap / 2]) {
      roundRect(ctx, x - lensWidth / 2, -lensHeight / 2, lensWidth, lensHeight, lensHeight * .3);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - lensWidth * .28, -lensHeight * .28);
      ctx.lineTo(x + lensWidth * .1, -lensHeight * .08);
      ctx.strokeStyle = 'rgba(255,255,255,.48)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(244, 218, 148, .92)';
      ctx.lineWidth = Math.max(2, faceWidth * .012);
    }
    ctx.beginPath();
    ctx.moveTo(-eyeGap / 2 + lensWidth / 2, 0);
    ctx.quadraticCurveTo(0, -lensHeight * .18, eyeGap / 2 - lensWidth / 2, 0);
    ctx.stroke();
    ctx.restore();
  }

  _mask(leftEye, rightEye, nose, faceWidth, roll, elapsed) {
    const ctx = this.ctx;
    const cx = (leftEye.x + rightEye.x) / 2;
    const cy = (leftEye.y + rightEye.y) / 2 + faceWidth * .02;
    const width = faceWidth * .93;
    const height = faceWidth * .34;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(roll);
    ctx.beginPath();
    ctx.moveTo(-width / 2, 0);
    ctx.quadraticCurveTo(-width * .32, -height * .78, 0, -height * .48);
    ctx.quadraticCurveTo(width * .32, -height * .78, width / 2, 0);
    ctx.quadraticCurveTo(width * .28, height * .58, 0, height * .3);
    ctx.quadraticCurveTo(-width * .28, height * .58, -width / 2, 0);
    const gradient = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
    gradient.addColorStop(0, 'rgba(52, 18, 89, .88)');
    gradient.addColorStop(.5, 'rgba(18, 8, 35, .78)');
    gradient.addColorStop(1, 'rgba(112, 53, 154, .88)');
    ctx.fillStyle = gradient;
    ctx.strokeStyle = 'rgba(235, 204, 127, .9)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#b665ff';
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.stroke();
    const eyeGap = Math.abs(rightEye.x - leftEye.x);
    ctx.globalCompositeOperation = 'destination-out';
    for (const x of [-eyeGap / 2, eyeGap / 2]) {
      ctx.beginPath();
      ctx.ellipse(x, 0, faceWidth * .115, faceWidth * .055, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(245, 218, 145, ${.72 + Math.sin(elapsed * 2.4) * .1})`;
    ctx.beginPath();
    ctx.arc(nose.x - cx, nose.y - cy - faceWidth * .02, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _cat(top, nose, left, right, faceWidth, faceHeight, roll, elapsed) {
    const ctx = this.ctx;
    const cx = (left.x + right.x) / 2;
    const baseY = top.y - faceHeight * .02;
    ctx.save();
    ctx.translate(cx, baseY);
    ctx.rotate(roll);
    const earWidth = faceWidth * .3;
    const earHeight = faceHeight * .35;
    ctx.fillStyle = 'rgba(48, 25, 67, .9)';
    ctx.strokeStyle = 'rgba(231, 199, 116, .9)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#a45cff';
    ctx.shadowBlur = 13;
    for (const side of [-1, 1]) {
      const x = side * faceWidth * .34;
      ctx.beginPath();
      ctx.moveTo(x - earWidth / 2, 0);
      ctx.lineTo(x, -earHeight * (1 + Math.sin(elapsed * 2 + side) * .02));
      ctx.lineTo(x + earWidth / 2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - earWidth * .22, -earHeight * .08);
      ctx.lineTo(x, -earHeight * .7);
      ctx.lineTo(x + earWidth * .22, -earHeight * .08);
      ctx.strokeStyle = 'rgba(222, 133, 189, .75)';
      ctx.stroke();
      ctx.strokeStyle = 'rgba(231, 199, 116, .9)';
    }
    ctx.restore();
    ctx.save();
    ctx.translate(nose.x, nose.y + faceWidth * .035);
    ctx.rotate(roll);
    ctx.fillStyle = 'rgba(231, 153, 193, .9)';
    ctx.beginPath();
    ctx.moveTo(-faceWidth * .035, 0);
    ctx.lineTo(faceWidth * .035, 0);
    ctx.lineTo(0, faceWidth * .035);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(242, 220, 255, .7)';
    ctx.lineWidth = 1.3;
    for (const side of [-1, 1]) {
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath();
        ctx.moveTo(side * faceWidth * .07, faceWidth * (.055 + i * .025));
        ctx.lineTo(side * faceWidth * .54, faceWidth * (.02 + i * .09));
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  _halo(top, faceWidth, faceHeight, roll, elapsed) {
    const ctx = this.ctx;
    const y = top.y - faceHeight * .28;
    ctx.save();
    ctx.translate(top.x, y);
    ctx.rotate(roll);
    ctx.scale(1, .28);
    ctx.beginPath();
    ctx.ellipse(0, 0, faceWidth * .56, faceWidth * .56, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 225, 140, ${.82 + Math.sin(elapsed * 2) * .1})`;
    ctx.lineWidth = Math.max(7, faceWidth * .035);
    ctx.shadowColor = '#ffd77c';
    ctx.shadowBlur = 24;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }

  _emojiOrbit(cx, cy, faceWidth, faceHeight, elapsed, mouthOpen) {
    const ctx = this.ctx;
    const glyphs = ['✨', '🔮', '🌙', '⭐', '🪄'];
    const radius = faceWidth * (.78 + Math.min(mouthOpen, .08) * 2.2);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.max(20, faceWidth * .1)}px "Segoe UI Emoji"`;
    ctx.shadowColor = '#a95cff';
    ctx.shadowBlur = 14;
    glyphs.forEach((glyph, i) => {
      const angle = elapsed * .42 + i * Math.PI * 2 / glyphs.length;
      const bob = Math.sin(elapsed * 2.2 + i) * faceHeight * .035;
      ctx.save();
      ctx.translate(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius * 1.18 + bob);
      ctx.rotate(-angle + Math.sin(elapsed + i) * .12);
      ctx.fillText(glyph, 0, 0);
      ctx.restore();
    });
    ctx.restore();
  }

  _scan(landmarks, video, cx, cy, faceWidth, faceHeight, elapsed) {
    const ctx = this.ctx;
    const scanY = cy - faceHeight / 2 + ((elapsed * .35) % 1) * faceHeight;
    ctx.save();
    ctx.strokeStyle = 'rgba(91, 233, 255, .72)';
    ctx.fillStyle = 'rgba(91, 233, 255, .7)';
    ctx.lineWidth = 1;
    ctx.shadowColor = '#51e6ff';
    ctx.shadowBlur = 9;
    ctx.beginPath();
    ctx.moveTo(cx - faceWidth * .58, scanY);
    ctx.lineTo(cx + faceWidth * .58, scanY);
    ctx.stroke();
    for (let i = 0; i < landmarks.length; i += 12) {
      const p = project(landmarks[i], video);
      const distance = Math.abs(p.y - scanY);
      if (distance > faceHeight * .19) continue;
      ctx.globalAlpha = 1 - distance / (faceHeight * .19);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = .85;
    ctx.font = `${Math.max(8, faceWidth * .028)}px monospace`;
    ctx.fillText('FACE LOCK', cx - faceWidth * .58, cy - faceHeight * .57);
    ctx.fillText('TRACKING 468 POINTS', cx - faceWidth * .58, cy + faceHeight * .62);
    ctx.restore();
  }

  // An original, high-polish "mirror comes alive" treatment. It is drawn from
  // tracked proportions rather than a screen-space sticker, so it stays locked
  // to a person as they move toward the glass.
  _enchantedReveal(cx, cy, faceWidth, faceHeight, roll, elapsed) {
    const ctx = this.ctx;
    const breath = 1 + Math.sin(elapsed * 1.25) * .018;
    const outerX = faceWidth * 1.1 * breath;
    const outerY = faceHeight * 1.32 * breath;
    const gold = 'rgba(255, 216, 139, .88)';
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(roll * .35);

    // Soft reflected light, kept behind the fine ornament.
    const glow = ctx.createRadialGradient(0, 0, faceWidth * .25, 0, 0, outerX * 1.25);
    glow.addColorStop(0, 'rgba(255, 238, 190, 0)');
    glow.addColorStop(.55, 'rgba(255, 196, 101, .09)');
    glow.addColorStop(1, 'rgba(133, 82, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(0, 0, outerX * 1.28, outerY * 1.08, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = 'round';
    ctx.shadowColor = '#ffd07a';
    ctx.shadowBlur = Math.max(12, faceWidth * .12);
    // Fine broken rings feel more like cast light than a static filter.
    for (let ring = 0; ring < 3; ring += 1) {
      const inset = ring * faceWidth * .105;
      ctx.beginPath();
      ctx.ellipse(0, 0, outerX - inset, outerY - inset * 1.15, 0, elapsed * (.11 + ring * .035), elapsed * (.11 + ring * .035) + Math.PI * 1.43);
      ctx.strokeStyle = ring === 0 ? gold : `rgba(229, 190, 255, ${.45 - ring * .08})`;
      ctx.lineWidth = Math.max(1, faceWidth * (.011 - ring * .002));
      ctx.stroke();
    }

    // A pair of restrained ornamental flourishes; unlike an emoji overlay,
    // each one scales with the face and has a slow living motion.
    ctx.shadowBlur = Math.max(7, faceWidth * .07);
    ctx.strokeStyle = 'rgba(255, 225, 164, .7)';
    ctx.lineWidth = Math.max(1, faceWidth * .008);
    for (const side of [-1, 1]) {
      const x = side * outerX * .78;
      const sway = Math.sin(elapsed * 1.4 + side) * faceWidth * .025;
      ctx.beginPath();
      ctx.moveTo(x, -outerY * .38);
      ctx.bezierCurveTo(x + side * faceWidth * .3, -outerY * .2, x - side * faceWidth * .16, outerY * .03, x + side * faceWidth * .03, outerY * .24 + sway);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + side * faceWidth * .03, outerY * .25 + sway, faceWidth * .052, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Deterministic motes avoid random-frame flicker and give a cinematic drift.
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#fff1c9';
    for (let i = 0; i < 24; i += 1) {
      const phase = i * 2.399 + elapsed * (.32 + (i % 4) * .035);
      const orbit = .56 + (i % 5) * .115;
      const x = Math.cos(phase) * outerX * orbit;
      const y = Math.sin(phase * 1.13) * outerY * orbit;
      const shimmer = .25 + .75 * Math.max(0, Math.sin(elapsed * 2.5 + i * 1.71));
      const size = Math.max(1, faceWidth * (.006 + (i % 3) * .002));
      ctx.globalAlpha = shimmer;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      if (i % 4 === 0) {
        ctx.globalAlpha = shimmer * .65;
        ctx.fillRect(x - size * 2.4, y - .5, size * 4.8, 1);
        ctx.fillRect(x - .5, y - size * 2.4, 1, size * 4.8);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function project(landmark, video) {
  const bounds = video.closest('#app-shell')?.getBoundingClientRect();
  const width = bounds?.width || window.innerWidth;
  const height = bounds?.height || window.innerHeight;
  const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
  const renderedWidth = video.videoWidth * scale;
  const renderedHeight = video.videoHeight * scale;
  const offsetX = (width - renderedWidth) / 2;
  const offsetY = (height - renderedHeight) / 2;
  const unmirroredX = offsetX + landmark.x * renderedWidth;
  return { x: width - unmirroredX, y: offsetY + landmark.y * renderedHeight };
}
