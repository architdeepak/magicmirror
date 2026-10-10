import { FrameTracking } from './frameTracking.js';

export class HandTracking extends FrameTracking {
  constructor(video, onHand = () => {}, onStatus = () => {}) { super(video, onHand, onStatus); }
  get onHand() { return this.onResult; }
  set onHand(value) { this.onResult = value; }
}
