// Animate the existing texture itself. Feathered, bounded feature crops avoid
// duplicate painted eyebrows and skin-colored ellipse eyelids.
//
// Cost model (this ran at ~65 drawImage calls per feature per frame): the
// horizontal gaze/smile pass is a smooth sine displacement, so a dozen strips
// are indistinguishable from forty; a blink or "wide" eye is an exactly
// piecewise-linear vertical map, so it is three draws, not twenty-eight; a pass
// that has nothing to do is skipped; and an unchanged request re-blits the
// previous result.
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const quantize = (value, step) => Math.round(value / step) * step;

export class FaceFeatures {
  constructor(image, spec) {
    this.spec = spec;
    const iw = image.naturalWidth || image.width, ih = image.naturalHeight || image.height;
    this.iw = iw; this.ih = ih;
    this.eyes = [-1, 1].map(side => this.crop(image, side * (spec.eyeX ?? .125), spec.eyeY ?? .06, .195, .108));
    this.brows = [-1, 1].map(side => this.crop(image, side * (spec.eyeX ?? .125), (spec.eyeY ?? .06) - .073, .22, .10));
    this.mouth = this.crop(image, 0, spec.mouthY ?? .23, .26, .13);
    this.stats = { warps: 0, cached: 0, strips: 0 };
  }

  crop(image, x, y, width, height) {
    const iw = this.iw, ih = this.ih;
    const make = () => { const c = document.createElement('canvas'); c.width = Math.ceil(iw * width); c.height = Math.ceil(ih * height); return c; };
    const source = make(), context = source.getContext('2d');
    context.drawImage(image, iw * (.5 + x - width / 2), ih * (.5 + y - height / 2), iw * width, ih * height, 0, 0, source.width, source.height);
    const mask = make(), m = mask.getContext('2d');
    m.translate(mask.width / 2, mask.height / 2); m.scale(mask.width / 2, mask.height / 2);
    const gradient = m.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, '#fff'); gradient.addColorStop(.74, '#fff'); gradient.addColorStop(1, 'rgba(255,255,255,0)'); m.fillStyle = gradient; m.fillRect(-1, -1, 2, 2);
    return { source, pass: make(), output: make(), mask, x, y, width, height, key: '' };
  }

  warp(ctx, feature, size, { blink = 0, dx = 0, lift = 0, smile = 0, wide = 0, headHeight = size } = {}) {
    const { source, pass, output, mask } = feature, w = source.width, h = source.height;
    // Quantise the request: tiny differences are invisible, and an unchanged
    // key means the previous output is still exactly right.
    const q = { blink: quantize(clamp(blink, 0, .995), .02), dx: quantize(dx, .0012), lift: quantize(lift, .015), smile: quantize(smile, .02), wide: quantize(wide, .03) };
    const detail = this.detail || 1;
    const key = `${q.blink}|${q.dx}|${q.lift}|${q.smile}|${q.wide}|${detail}`;
    this.stats.warps++;
    if (key === feature.key) { this.stats.cached++; this._blit(ctx, feature, size, headHeight); return; }
    feature.key = key;
    const b = output.getContext('2d');
    b.clearRect(0, 0, w, h);
    const close = q.blink, eyeScale = 1 - close;
    const needsH = Math.abs(q.dx) > 0 || q.smile > 0;
    const needsV = close > .001 || q.wide > .001 || Math.abs(q.lift) > 0;
    // The last pass writes straight into `output`; an earlier pass uses `pass`.
    let from = source;
    if (needsH) {
      const target = needsV ? pass : output, a = target.getContext('2d');
      if (target === pass) a.clearRect(0, 0, w, h);
      const columns = clamp(Math.round((q.smile > 0 ? 14 : 10) * detail), 8, 24);
      // At the crop boundary displacement is zero, so the original face stays seamless.
      const mapX = t => t * w + q.dx * w * Math.sin(t * Math.PI) ** 2;
      for (let i = 0; i < columns; i++) {
        const left = i / columns, right = (i + 1) / columns, x = mapX(left), next = mapX(right);
        const y = -q.smile * h * .32 * (Math.abs(left - .5) * 2) ** 1.4 * Math.sin(left * Math.PI);
        a.drawImage(source, left * w, 0, w / columns, h, x, y, next - x + .5, h);
      }
      this.stats.strips += columns;
      from = target;
    }
    if (needsV) {
      if (close > .001 || q.wide > .001) {
        // Exactly piecewise linear: lid band above, the eye opening, lid band below.
        // A blink owns closure even if a surprised/wide-eye mood is active.
        const scale = Math.min(1.25, eyeScale * (1 + q.wide * .22));
        const upper = .5 - .22 * scale, lowerStart = .5 + .22 * scale, lowerSize = .5 - .22 * scale;
        b.drawImage(from, 0, 0, w, h * .28, 0, 0, w, upper * h + .5);
        b.drawImage(from, 0, h * .28, w, h * .44, 0, upper * h, w, (lowerStart - upper) * h + .5);
        b.drawImage(from, 0, h * .72, w, h * .28, 0, lowerStart * h, w, lowerSize * h);
        this.stats.strips += 3;
      } else {
        const rows = clamp(Math.round(8 * detail), 6, 16);
        const mapY = t => (t - q.lift * .29 * Math.sin(t * Math.PI) ** 2) * h;
        for (let i = 0; i < rows; i++) {
          const top = i / rows, bottom = (i + 1) / rows, y = mapY(top), next = mapY(bottom);
          b.drawImage(from, 0, top * h, w, h / rows, 0, y, w, next - y + .5);
        }
        this.stats.strips += rows;
      }
    } else if (from !== output) {
      b.drawImage(from, 0, 0);
    }
    b.globalCompositeOperation = 'destination-in'; b.drawImage(mask, 0, 0); b.globalCompositeOperation = 'source-over';
    this._blit(ctx, feature, size, headHeight);
  }

  _blit(ctx, feature, size, headHeight) {
    ctx.drawImage(feature.output, (feature.x - feature.width / 2) * size, (feature.y - feature.height / 2) * headHeight, feature.width * size, feature.height * headHeight);
  }

  draw(ctx, size, values, gaze, jaw, headHeight = size) {
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 'Left' : 'Right', blink = Math.max(values['eyeBlink' + side] || 0, (values['cheekSquint' + side] || 0) * .45), wide = values['eyeWide' + side] || 0;
      const gx = Math.max(-1, Math.min(1, (gaze.x || 0) * (gaze.confidence || 0))) * .06;
      if (blink > .008 || Math.abs(gx) > .003 || wide > .03) this.warp(ctx, this.eyes[i], size, { blink, wide, dx: gx, headHeight });
      const lift = Math.max(values.browInnerUp || 0, values['browOuterUp' + side] || 0) - (values['browDown' + side] || 0) * .55;
      if (Math.abs(lift) > .015) this.warp(ctx, this.brows[i], size, { lift, headHeight });
    }
    const smile = Math.max(values.mouthSmileLeft || 0, values.mouthSmileRight || 0);
    if (jaw < .055 && smile > .03) this.warp(ctx, this.mouth, size, { smile, headHeight });
  }
}
