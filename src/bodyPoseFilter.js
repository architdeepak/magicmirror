// Smooth small landmark jitter while allowing deliberate body movement to
// catch up quickly. Never blend across a lost pose, camera, or long frame gap.
export class BodyPoseFilter {
  constructor() { this.reset(); }
  reset() { this.pose = null; this.timestamp = 0; }
  update(pose, timestamp) {
    if (!pose?.length) { this.reset(); return null; }
    const previous = this.pose;
    const elapsed = timestamp - this.timestamp;
    const reset = !previous || previous.length !== pose.length || elapsed <= 0 || elapsed > 400;
    const next = pose.map((point, index) => {
      const before = previous?.[index];
      if (reset || !before || (point.visibility ?? 1) < .5 || (before.visibility ?? 1) < .5) return { ...point };
      const movement = Math.hypot(point.x - before.x, point.y - before.y);
      if (movement > .15) return { ...point };
      const response = Math.min(.92, .35 + movement * 9);
      const alpha = 1 - Math.pow(1 - response, elapsed / 100);
      return { ...point,
        x: before.x + (point.x - before.x) * alpha,
        y: before.y + (point.y - before.y) * alpha,
        z: before.z + (point.z - before.z) * alpha
      };
    });
    this.pose = next; this.timestamp = timestamp;
    return next;
  }
}
