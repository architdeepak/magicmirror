// A bounded, advected density field. Soft transmitted light replaces outlines
// and star sprites. It runs only during an explicit summon/arrival cue.
export class MirrorFog {
  constructor(width = 240, height = 360) {
    this.canvas = document.createElement('canvas'); this.canvas.width = width; this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d'); this.image = this.ctx.createImageData(width, height);
    this.noise = new Float32Array(128 * 128);
    let seed = 71391;
    for (let i = 0; i < this.noise.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; this.noise[i] = (seed >>> 0) / 4294967296; }
    this.frames = 0;
  }
  sample(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = this.noise[(iy & 127) * 128 + (ix & 127)], b = this.noise[(iy & 127) * 128 + ((ix + 1) & 127)];
    const c = this.noise[((iy + 1) & 127) * 128 + (ix & 127)], d = this.noise[((iy + 1) & 127) * 128 + ((ix + 1) & 127)];
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  }
  render(progress, arrival = false) {
    const pixels = this.image.data, w = this.canvas.width, h = this.canvas.height, time = arrival ? 3 + progress * 1.1 : progress * 3.0;
    const envelope = arrival ? .54 * Math.pow(1 - progress, 1.6) : smooth(0, .22, progress) * (1 - .46 * smooth(.65, 1, progress));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = (x / w - .5) * 2, v = (y / h - .48) * 2;
      const r2 = u * u * .85 + v * v * .72;
      // Domain warping and rising, differently scaled layers prevent a rotating
      // circular sticker. The finest octave stays low contrast when upscaled.
      const warp = this.sample(u * 3 + 40 + time * .55, v * 3 + 16 - time * .8);
      const nx = u * 5 + warp * 2.9 + time * .7 + 58;
      const ny = v * 5 + warp * 2.0 - time * 1.65 + 41;
      const coarse = this.sample(nx, ny), detail = this.sample(nx * 2.13 + 11, ny * 2.13 - time * .45);
      const fine = this.sample(nx * 4.17 - 28, ny * 4.17 + 30);
      const density = Math.max(0, (coarse * .64 + detail * .26 + fine * .1 - .23) * 1.5);
      const falloff = Math.max(0, 1 - r2 * .72);
      const clearing = arrival ? 1 - smooth(0, .85, progress) * Math.exp(-r2 * 4) : 1;
      const alpha = Math.min(.88, density * density * falloff * envelope * clearing);
      const light = this.sample(nx - .32, ny - .26) - coarse;
      const silver = Math.min(1, .26 + density * .55 + Math.max(0, light) * 2.4);
      const warm = Math.exp(-((u + .35) ** 2 * 4 + (v + .05) ** 2 * 2)) * (arrival ? 1 : smooth(.12, .55, progress)) * .55;
      const i = (y * w + x) * 4;
      pixels[i] = 38 + silver * 119 + warm * 24;
      pixels[i + 1] = 42 + silver * 126 + warm * 9;
      pixels[i + 2] = 50 + silver * 145 - warm * 15;
      pixels[i + 3] = alpha * 255;
    }
    this.ctx.putImageData(this.image, 0, 0); this.frames++; return this.canvas;
  }
}
function smooth(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
