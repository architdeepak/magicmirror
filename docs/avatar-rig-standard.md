# Expressive Host Rig Standard

The live mirror host is a face-only 3D performer, never a generated portrait
that is scaled, warped, or frame-swapped to fake speech.

## Required source asset

Each persona is delivered as one GLB or VRM with a stable neutral head, a
separate eye rig, and 52 named ARKit-compatible facial morph targets. The
asset must render as a head-only crop from the neutral camera; no neck, torso,
or body must enter the frame at any head-pose extreme.

The minimum runtime expression contract is:

- `eyeBlinkLeft`, `eyeBlinkRight`, `eyeLook*`, `eyeWide*`, `eyeSquint*`
- `browInnerUp`, `browOuterUpLeft`, `browOuterUpRight`, `browDown*`
- `jawOpen`, `mouthClose`, `mouthFunnel`, `mouthPucker`
- `mouthSmile*`, `mouthFrown*`, `mouthStretch*`, `mouthUpperUp*`,
  `mouthLowerDown*`
- `cheekPuff`, `cheekSquint*`, `noseSneer*`, `tongueOut`

## Runtime layers

1. MediaPipe Face Landmarker supplies camera blendshape scores, landmark
   matrices, and iris position at camera frame rate.
2. The host rig receives independently smoothed eye, eyelid, brow, jaw, lip,
   cheek, and head-pose channels. No whole-face texture crossfade is allowed.
3. TTS supplies phoneme/viseme timing. It only drives mouth and jaw channels;
   it must not overwrite a tracked blink, gaze, smile, or expression.
4. A small performance planner may add sparse glances and nods. It must never
   add a periodic idle bounce.

## Acceptance gate

Before a persona becomes visible in the mirror, capture neutral, blink, AA,
OH, smile, brow-up, left-gaze, and right-gaze frames. Reject the rig if any
test changes head width, hair silhouette, eye placement, or facial identity.
Reject it if a mouth shape becomes a dark sticker or if the crop exposes a
body. A talking demo is approved only after the face is stable throughout the
whole clip, not merely in a single good screenshot.
