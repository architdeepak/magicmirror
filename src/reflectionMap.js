// Two-way mirror geometry. Behind one-way glass the wearer sees their own
// reflection, not the camera picture, so a garment must be drawn where the
// reflection of their body appears on the glass plane.
//
// For a body point at depth z and eyes at depth ze in front of the glass, the
// reflection's image sits z behind the plane and the sight line from the eye
// crosses the plane at t = ze / (ze + z) of the way to the body point. With the
// body about as far as the eyes, t ~ 1/2. The camera sits in the glass plane, so
// camera-image offsets scale to metres by (shoulder width / shoulder pixels).
//
// The result is one uniform scale and translation of the camera-aligned
// drawing, so a single canvas transform places the garment, its occlusion and
// its shading consistently.
const SHOULDER_WIDTH_M = 0.38;

export function reflectionTransform({ pose, video, viewport, screenWidthM = 0.51, mount = 'top', previous = null, smoothing = 0.35, sizePercent = 100, nudgeYPercent = 0 }) {
  const left = pose?.[11], right = pose?.[12];
  if (!left || !right || (left.visibility ?? 1) < .5 || (right.visibility ?? 1) < .5) return previous;
  const shoulderPx = Math.hypot((right.x - left.x) * video.width, (right.y - left.y) * video.height);
  if (!(shoulderPx > 12)) return previous;
  const cameraFieldM = SHOULDER_WIDTH_M * video.width / shoulderPx;           // scene width the camera sees at the wearer's depth
  const g = Math.min(4, Math.max(.5, .5 * cameraFieldM / screenWidthM * Math.min(1.5, Math.max(.6, sizePercent / 100))));       // glass-plane px per camera-display px
  const scale = Math.max(viewport.width / video.width, viewport.height / video.height);
  const width = video.width * scale, height = video.height * scale;
  const project = point => ({ x: viewport.width - ((viewport.width - width) / 2 + point.x * width), y: (viewport.height - height) / 2 + point.y * height });
  const leftEye = pose[2], rightEye = pose[5];
  const haveEyes = leftEye && rightEye && (leftEye.visibility ?? 1) >= .5 && (rightEye.visibility ?? 1) >= .5;
  const eye = project(haveEyes ? { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 }
    : { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 - (shoulderPx / video.width) * .9 });
  const imageCenter = { x: viewport.width / 2, y: viewport.height / 2 };
  const origin = { x: viewport.width / 2, y: mount === 'top' ? 0 : viewport.height / 2 };
  // p = origin + g * (v + eye - 2 * imageCenter)  ==  g * v + translation
  // The two optional trims absorb camera tilt and mounting height errors.
  const next = { g, tx: origin.x + g * (eye.x - 2 * imageCenter.x), ty: origin.y + g * (eye.y - 2 * imageCenter.y) + viewport.height * Math.min(40, Math.max(-40, nudgeYPercent)) / 100 };
  if (!previous) return next;
  return { g: previous.g + (next.g - previous.g) * smoothing, tx: previous.tx + (next.tx - previous.tx) * smoothing, ty: previous.ty + (next.ty - previous.ty) * smoothing };
}
