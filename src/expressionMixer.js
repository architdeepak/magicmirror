// One stable expression bus for a real face rig. Camera tracking, voice, and
// authored emotion each own different parts of the face; they must never be
// implemented by replacing a whole face render or by blindly overwriting each
// other's blendshape values.
const VISEMES = Object.freeze({
  rest: { mouthClose: .22 },
  AA: { jawOpen: .78, mouthStretchLeft: .16, mouthStretchRight: .16, mouthLowerDownLeft: .22, mouthLowerDownRight: .22 },
  O: { jawOpen: .30, mouthFunnel: .74, mouthPucker: .20 },
  EE: { jawOpen: .18, mouthStretchLeft: .44, mouthStretchRight: .44, mouthSmileLeft: .10, mouthSmileRight: .10 },
  OU: { jawOpen: .22, mouthPucker: .70, mouthFunnel: .38 }
});

const EMOTIONS = Object.freeze({
  neutral: {},
  happy: { mouthSmileLeft: .42, mouthSmileRight: .42, cheekSquintLeft: .12, cheekSquintRight: .12 },
  thoughtful: { browInnerUp: .16, mouthPressLeft: .08, mouthPressRight: .08 },
  surprised: { browInnerUp: .44, eyeWideLeft: .34, eyeWideRight: .34 }
});

const PROTECTED_TRACKING = new Set([
  'eyeBlinkLeft', 'eyeBlinkRight', 'eyeLookUpLeft', 'eyeLookUpRight',
  'eyeLookDownLeft', 'eyeLookDownRight', 'eyeLookInLeft', 'eyeLookInRight',
  'eyeLookOutLeft', 'eyeLookOutRight'
]);

export class ExpressionMixer {
  constructor() { this.values = {}; this.mood = 'neutral'; }

  setMood(mood) { this.mood = EMOTIONS[mood] ? mood : 'neutral'; }

  update({ tracking = {}, manual = {}, speech = 0, viseme = 'rest', dt = 1 / 60 } = {}) {
    const target = { ...tracking };
    // App-driven expressions can accent the tracked performer but do not get
    // to erase a real blink or gaze signal from the camera.
    for (const [name, value] of Object.entries(manual)) {
      if (!PROTECTED_TRACKING.has(name) || target[name] == null) target[name] = Math.max(target[name] || 0, value || 0);
    }
    for (const [name, value] of Object.entries(EMOTIONS[this.mood])) target[name] = Math.max(target[name] || 0, value);

    const voice = VISEMES[viseme] || VISEMES.rest;
    const energy = clamp(speech, 0, 1);
    for (const [name, value] of Object.entries(voice)) target[name] = Math.max(target[name] || 0, value * energy);
    if (energy > .025) target.jawOpen = Math.max(target.jawOpen || 0, energy * .72);

    // Fast enough for consonants, slow enough to avoid webcam jitter. Closing
    // a lid needs more speed than opening a jaw, so clamp a common envelope.
    const alpha = clamp(1 - Math.exp(-Math.max(.001, dt) * 19), .12, .58);
    for (const name of new Set([...Object.keys(this.values), ...Object.keys(target)])) {
      const next = clamp(target[name] || 0, 0, 1);
      const previous = this.values[name] || 0;
      const response = name.startsWith('eyeBlink') ? Math.min(.94, 1 - Math.exp(-Math.max(.001, dt) * 65)) : alpha;
      this.values[name] = previous + (next - previous) * response;
    }
    return { ...this.values };
  }
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
