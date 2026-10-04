const FACE_OVAL = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
const FACE_PATHS = [
  [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246],
  [263,249,390,373,374,380,381,382,362,398,384,385,386,387,388,466],
  [70,63,105,66,107,55,65,52,53,46],
  [300,293,334,296,336,285,295,282,283,276],
  [168,6,197,195,5,4,1,19,94,2],
  [61,40,37,0,267,270,291,321,314,17,84,91]
];
const HAND_BONES = [[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[17,0]];
const HAND_COLORS = ['#6bcbff', '#ffbf70'];

// A transparent instrumentation layer. Its coordinates intentionally use the
// same mirrored camera-cover projection as the camera preview and try-on AR.
export class TrackingDebugOverlay {
  constructor(shell, video) {
    this.shell = shell;
    this.video = video;
    this.enabled = false;
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'tracking-debug-overlay';
    this.canvas.setAttribute('aria-hidden', 'true');
    Object.assign(this.canvas.style, {position:'absolute', inset:'0', width:'100%', height:'100%', pointerEvents:'none', zIndex:'70', display:'none'});
    shell.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.resize();
    this.observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.resize()) : null;
    this.observer?.observe(shell);
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.canvas.style.display = this.enabled ? 'block' : 'none';
    if (!this.enabled) this.clear();
    return this.enabled;
  }

  resize() {
    const bounds = this.shell.getBoundingClientRect();
    this.width = Math.max(1, Math.round(bounds.width));
    this.height = Math.max(1, Math.round(bounds.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  clear() { this.ctx.clearRect(0, 0, this.width, this.height); }

  project(point) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    if (!this.video?.videoWidth || !this.video?.videoHeight) return {x:(1-point.x)*this.width, y:point.y*this.height};
    const scale = Math.max(this.width / this.video.videoWidth, this.height / this.video.videoHeight);
    const renderedWidth = this.video.videoWidth * scale;
    const renderedHeight = this.video.videoHeight * scale;
    return {x:(this.width-renderedWidth)/2+(1-point.x)*renderedWidth,
      y:(this.height-renderedHeight)/2+point.y*renderedHeight};
  }

  _path(points, indices, color, closed = false) {
    const ctx = this.ctx;
    ctx.beginPath();
    let started = false;
    for (const index of indices) {
      const point = points[index];
      if (!point) continue;
      if (!started) { ctx.moveTo(point.x, point.y); started = true; }
      else ctx.lineTo(point.x, point.y);
    }
    if (!started) return;
    if (closed) ctx.closePath();
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  draw({ face = null, hands = [], status = {}, viewer = {}, handStatus = '', depthEnabled = true } = {}) {
    if (!this.enabled) return;
    this.clear();
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = Math.max(1.5, this.width / 520);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    let faceVisible = false;
    if (face?.length) {
      const points = face.map(point => this.project(point));
      faceVisible = points.some(point => point && point.x >= 0 && point.x <= this.width && point.y >= 0 && point.y <= this.height);
      this._path(points, FACE_OVAL, '#7affbe', true);
      for (const path of FACE_PATHS) this._path(points, path, '#a3ffe0', path.length > 12);
      for (const index of [1,33,263,13,14,468,473]) {
        const point = points[index];
        if (!point) continue;
        ctx.beginPath(); ctx.arc(point.x, point.y, 3, 0, Math.PI*2); ctx.fillStyle = '#dcffee'; ctx.fill();
      }
    }
    const handList = Array.isArray(hands) ? hands : hands.landmarks || [];
    handList.forEach((hand, handIndex) => {
      const raw = Array.isArray(hand) ? hand : hand.landmarks || hand.hand || [];
      const points = hand.screenHand ? hand.screenHand.map(point => ({x:point.x*this.width,y:point.y*this.height})) : raw.map(point => this.project(point));
      const color = HAND_COLORS[handIndex % HAND_COLORS.length];
      for (const bones of HAND_BONES) this._path(points, bones, color);
      points.forEach((point,index) => {
        if (!point) return;
        ctx.beginPath(); ctx.arc(point.x,point.y,[4,8,12,16,20].includes(index)?4:2,0,Math.PI*2);
        ctx.fillStyle = color; ctx.fill();
      });
    });

    const faceLocked = Boolean(status.faceDetected && face?.length);
    const lines = [
      `TRACKING DEBUG  |  FACE ${faceLocked?'LOCKED':'SEARCHING'}  |  HANDS ${handList.length || handStatus || 'SEARCHING'}`,
      `${depthEnabled?'3D ON':'3D OFF'}  |  X ${finite(viewer.x)}  Y ${finite(viewer.y)}  Z ${finite(viewer.z)}  |  FACE ${finite(status.detectionMs)} ms`,
      status.cameraActive ? `${status.activeCameraLabel || 'Camera'}  |  ${this.video?.videoWidth || 0} x ${this.video?.videoHeight || 0}` : 'Camera off. Turn on the camera to test tracking.'
    ];
    if (status.error) lines.push(status.error);
    else if (!faceLocked && status.cameraActive) lines.push('Look toward the camera. Tilt the top camera down until your face is centered.');
    else if (faceLocked && !faceVisible) lines.push('Face found outside the portrait crop. Center yourself or adjust the camera angle.');
    else if (faceLocked) lines.push('Move left/right to check X, then choose Re-center camera at your normal spot.');
    const fontSize = Math.max(11, Math.min(20, this.width*.018));
    ctx.font = `500 ${fontSize}px monospace`;
    const padding = fontSize;
    const lineHeight = fontSize*1.6;
    const panelWidth = this.width-padding*2;
    const panelHeight = lines.length*lineHeight+padding*2;
    const top = Math.max(padding, this.height*.13);
    ctx.fillStyle = 'rgba(0,0,0,.82)'; ctx.fillRect(padding,top,panelWidth,panelHeight);
    ctx.strokeStyle = 'rgba(122,255,190,.35)'; ctx.lineWidth = 1; ctx.strokeRect(padding,top,panelWidth,panelHeight);
    lines.forEach((text,index) => {
      ctx.fillStyle = index===0?'#7affbe':'#e5f4ed';
      ctx.fillText(text,padding*2,top+padding+fontSize+index*lineHeight,panelWidth-padding*2);
    });
    ctx.restore();
  }

  dispose() { this.observer?.disconnect(); this.canvas.remove(); }
}

function finite(value) { return Number.isFinite(value) ? value.toFixed(2) : '0.00'; }
