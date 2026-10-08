// World shoulder orientation chooses which photographed side faces the camera.
// Hysteresis is counted on distinct analyzed frames, not display ticks.
export class GarmentFacing {
  constructor() { this.reset(); }
  reset() { this.view = 'front'; this.lastTimestamp = null; this.candidate = null; this.count = 0; }
  update(pose, world, timestamp) {
    if (timestamp === this.lastTimestamp) return this.view;
    if (!pose?.[11] || !pose?.[12] || Math.min(pose[11].visibility ?? 1,pose[12].visibility ?? 1) < .55) return this.view;
    const points = world?.[11] && world?.[12] ? world : pose;
    const a=points[11],b=points[12];
    if (![a.x,a.y,a.z,b.x,b.y,b.z].every(Number.isFinite)) return this.view;
    const length=Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
    if (length < 1e-5) return this.view;
    const score=(a.x-b.x)/length, next=score>.15?'front':score<-.15?'back':this.view;
    const first=this.lastTimestamp===null;this.lastTimestamp=timestamp;
    if(first){this.view=next;return this.view;}
    if(next===this.view){this.candidate=null;this.count=0;return this.view;}
    if(this.candidate!==next){this.candidate=next;this.count=1;}else this.count++;
    if(this.count>=2){this.view=next;this.candidate=null;this.count=0;}
    return this.view;
  }
}
