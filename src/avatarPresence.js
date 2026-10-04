// Conversational choreography in seconds, independent of display frame rate.
export class AvatarPresence {
  constructor() { this.state = 'ready'; this.age = 0; this.blinkClock = 0; }
  setState(state) {
    if (state === this.state) return;
    this.state = state;
    this.age = 0;
  }
  update(dt, viewer = {}, speech = 0) {
    const step = Math.min(.1, Math.max(0, dt));
    this.age += step;
    this.blinkClock += step;
    const t = this.age;
    const thinking = this.state === 'thinking' || this.state === 'connecting';
    const listening = this.state === 'listening';
    const speaking = this.state === 'speaking';
    const beat = (center, width) => Math.exp(-Math.pow((t - center) / width, 2));
    const phase = this.blinkClock % 4.7;
    const blink = phase > 4.48 ? Math.sin((phase - 4.48) / .22 * Math.PI) : 0;
    return {
      gaze: { x: thinking ? .30 : clamp((viewer.x || 0) * .45, -.5, .5),
        y: thinking ? -.18 : clamp((viewer.y || 0) * .25, -.3, .3), confidence: 1 },
      expression: { eyeBlinkLeft: blink, eyeBlinkRight: blink,
        browInnerUp: thinking ? .22 : listening ? .14 : speaking ? speech * .18 : .025 },
      performance: {
        turn: thinking ? .13 * (1 - Math.exp(-t * 2)) : clamp(viewer.x || 0, -1, 1) * .10,
        lean: thinking ? -.07 : listening ? .025 : 0,
        nod: listening ? -.12 * beat(.55, .2) + .04 * beat(.85, .18)
          : speaking ? speech * .07 * Math.sin(t * 2.8) : 0
      }
    };
  }
}
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
