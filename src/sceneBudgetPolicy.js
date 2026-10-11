// The 4K 3D scene and the face model share the same GPU/compositor. When the
// scene runs flat out, face inference queues behind it (measured: scene capped
// at 30 fps -> face frame age ~220 ms; at 20 fps -> ~125 ms; at 15 -> ~110 ms).
// Parallax tolerates 20 fps far better than it tolerates a late head position,
// so the scene's dynamic frame cap follows the measured face latency.
export function suggestSceneFps(current, faceInferenceMs, { base = 30, floor = 15 } = {}) {
  if (!Number.isFinite(faceInferenceMs) || faceInferenceMs <= 0) return Math.min(current, base);
  let target = current;
  if (faceInferenceMs > 140) target = floor;
  else if (faceInferenceMs > 90) target = Math.max(floor, Math.min(current, 20));
  else if (faceInferenceMs < 50) target = base;          // headroom: restore the smoother scene
  return Math.max(floor, Math.min(base, target));
}
