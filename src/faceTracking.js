import { FrameTracking } from './frameTracking.js';

export class FaceTracking extends FrameTracking {
  constructor(video, onFace = () => {}, onStatus = () => {}) {
    super(video, onFace, onStatus, { task: 'face', label: 'Face', interval: 32, maxAge: 300, maxWidth: 960, maxHeight: 720, retry: 'Turn the camera off and on to retry.' });
  }
}
