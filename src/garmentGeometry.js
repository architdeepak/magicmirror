export function projectCameraPoint(point, video, viewport) {
  const scale = Math.max(viewport.width / video.width, viewport.height / video.height);
  const width = video.width * scale;
  const height = video.height * scale;
  return { x: viewport.width - ((viewport.width - width) / 2 + point.x * width), y: (viewport.height - height) / 2 + point.y * height, z: point.z || 0 };
}

export function visiblePoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y) && (point.visibility ?? 1) >= .55;
}

// UV anchors describe a front-facing flat garment: shoulder seams at 22/78%
// and the hem near the bottom. A small triangle mesh follows torso skew rather
// than stretching an axis-aligned rectangle as the viewer turns or leans.
export function buildGarmentMesh(pose, video, viewport, category = 'top', fit = {}) {
  const width = fit.width ?? 1;
  const length = fit.length ?? 1;
  const offset = fit.offset ?? 0;
  const required = category === 'skirt' ? [23, 24, 25, 26] : category === 'bottoms' ? [23, 24, 25, 26, 27, 28] : [11, 12, 23, 24];
  if (!required.every((index) => visiblePoint(pose?.[index]))) return null;
  const project = (index) => projectCameraPoint(pose[index], video, viewport);
  const grids = [];
  if (category === 'skirt') {
    const hips = [project(23), project(24)].sort((a, b) => a.x - b.x);
    const top = midpoint(...hips), knees = midpoint(project(25), project(26));
    const across = subtract(hips[1], hips[0]);
    if (distance(...hips) < 12 || distance(top, knees) < 15) return null;
    grids.push(makeGrid(0, 1, 8, 8, (u, v) => {
      const center = interpolate(top, knees, v * length + offset);
      const flare = 1 + v * .55;
      return { x: center.x + across.x * (u - .5) * width * flare, y: center.y + across.y * (u - .5) * width * flare };
    }));
  } else if (category === 'bottoms') {
    // Keep every chain anatomical; crossing feet must not exchange textures.
    const legs = [{ hip: project(23), knee: project(25), ankle: project(27) }, { hip: project(24), knee: project(26), ankle: project(28) }].sort((a, b) => a.hip.x - b.hip.x);
    const hipWidth = distance(legs[0].hip, legs[1].hip);
    if (hipWidth < 12) return null;
    legs.forEach((leg, side) => {
      const u0 = side * .5;
      const rows = [...new Set([0, .06, .1725, .285, .3975, .51, .6225, .735, .8475, .96, 1,
        .06 + .45 / length, .06 + .9 / length])].filter(value => value >= 0 && value <= 1).sort((a, b) => a - b);
      grids.push(makeGrid(u0, u0 + .5, 4, 8, (u, v) => {
        const t = (v - .06) / .9 * length;
        const upper = t < .5;
        const from = upper ? leg.hip : leg.knee;
        const to = upper ? leg.knee : leg.ankle;
        const along = upper ? t * 2 : (t - .5) * 2;
        const center = interpolate(from, to, along);
        const depth = from.z + (to.z - from.z) * along;
        const thighNormal = limbNormal(leg.hip, leg.knee);
        const calfNormal = limbNormal(leg.knee, leg.ankle);
        // Both segments use exactly the same bounded miter at the knee.
        // Interpolating toward it avoids a texture tear at the direction change.
        const kneeNormal = kneeMiter(thighNormal, calfNormal);
        const normal = interpolate(upper ? thighNormal : kneeNormal,
          upper ? kneeNormal : calfNormal, Math.max(0, Math.min(1, upper ? t * 2 : (t - .5) * 2)));
        const taper = 1 - Math.max(0, Math.min(1, t)) * .32;
        const across = (u - (u0 + .25)) * 2 * hipWidth * width * taper;
        return { x: center.x + normal.x * across, y: center.y + normal.y * across + offset * distance(leg.hip, leg.ankle), z: depth };
      }, rows));
    });
  } else {
    const sides = [{ shoulder: project(11), hip: project(23) }, { shoulder: project(12), hip: project(24) }]
      .sort((a, b) => a.shoulder.x - b.shoulder.x);
    const shoulders = sides.map(side => side.shoulder);
    const hips = sides.map(side => side.hip);
    const shoulderWidth = distance(...shoulders);
    if (shoulderWidth < 20) return null;
    const top = midpoint(...shoulders);
    const bottom = midpoint(...hips);
    if (distance(top, bottom) < 25) return null;
    const dress = category === 'dress';
    grids.push(makeGrid(0, 1, 8, 8, (u, v) => {
      const t = (v - .12) / (dress ? .46 : .82) * length;
      const center = interpolate(top, bottom, t + offset);
      const upperAcross = subtract(shoulders[1], shoulders[0]);
      const lowerAcross = subtract(hips[1], hips[0]);
      const across = interpolate(upperAcross, lowerAcross, Math.max(0, Math.min(1, t)));
      const flare = dress ? 1 + Math.max(0, t - 1) * .18 : 1;
      return { x: center.x + across.x * (u - .5) / .56 * width * flare, y: center.y + across.y * (u - .5) / .56 * width * flare };
    }));
  }
  const triangles = grids.flatMap((grid) => grid);
  // MediaPipe depth decreases toward the camera. Preserve UV identity, but
  // draw the nearer leg last when the wearer crosses their legs.
  if (category === 'bottoms') triangles.sort((a, b) => averageDepth(b) - averageDepth(a));
  return triangles;
}

function makeGrid(u0, u1, columns, rows, map, rowValues = null) {
  if (rowValues) rows = rowValues.length - 1;
  const triangles = [];
  const point = (x, y) => {
    const u = u0 + (u1 - u0) * x / columns;
    const v = rowValues ? rowValues[y] : y / rows;
    return { ...map(u, v), u, v };
  };
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const a = point(x, y); const b = point(x + 1, y); const c = point(x + 1, y + 1); const d = point(x, y + 1);
      triangles.push([a, b, c], [a, c, d]);
    }
  }
  return triangles;
}

export function drawTexturedTriangle(ctx, texture, points) {
  const [p0, p1, p2] = points;
  const sx1 = (p1.u - p0.u) * texture.width; const sy1 = (p1.v - p0.v) * texture.height;
  const sx2 = (p2.u - p0.u) * texture.width; const sy2 = (p2.v - p0.v) * texture.height;
  const dx1 = p1.x - p0.x; const dy1 = p1.y - p0.y;
  const dx2 = p2.x - p0.x; const dy2 = p2.y - p0.y;
  const denominator = sx1 * sy2 - sx2 * sy1;
  if (Math.abs(denominator) < .001) return;
  const a = (dx1 * sy2 - dx2 * sy1) / denominator;
  const b = (dy1 * sy2 - dy2 * sy1) / denominator;
  const c = (sx1 * dx2 - sx2 * dx1) / denominator;
  const d = (sx1 * dy2 - sx2 * dy1) / denominator;
  const sx0 = p0.u * texture.width; const sy0 = p0.v * texture.height;
  // Canvas antialiases each clip independently. Half-covered shared edges
  // otherwise leave a visible triangular grid across an opaque photograph.
  // Expand only the clip by one raster pixel; keep the texture mapping intact.
  const transform = ctx.getTransform();
  const pixelScale = Math.min(Math.hypot(transform.a, transform.b), Math.hypot(transform.c, transform.d)) || 1;
  const clip = expandTriangle(points, .85 / pixelScale);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(clip[0].x, clip[0].y); ctx.lineTo(clip[1].x, clip[1].y); ctx.lineTo(clip[2].x, clip[2].y); ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, d, p0.x - a * sx0 - c * sy0, p0.y - b * sx0 - d * sy0);
  ctx.drawImage(texture, 0, 0);
  ctx.restore();
}

function expandTriangle(points, amount) {
  const [a, b, c] = points;
  const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const sign = area >= 0 ? 1 : -1;
  const normals = points.map((point, index) => {
    const next = points[(index + 1) % 3]; const dx = next.x - point.x; const dy = next.y - point.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: sign * dy / length, y: -sign * dx / length };
  });
  return points.map((point, index) => {
    const previous = normals[(index + 2) % 3]; const next = normals[index];
    const factor = Math.min(4, 1 / Math.max(.001, 1 + previous.x * next.x + previous.y * next.y));
    return { x: point.x + (previous.x + next.x) * amount * factor, y: point.y + (previous.y + next.y) * amount * factor };
  });
}

export function midpoint(a, b) { return interpolate(a, b, .5); }
export function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function subtract(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
function interpolate(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }

function limbNormal(from, to) {
  const dx = to.x - from.x; const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  // Missing-length limbs can occur when a knee is foreshortened. Keep the
  // mesh finite until visibility filtering receives the next pose frame.
  return length > .001 ? { x: dy / length, y: -dx / length } : { x: 1, y: 0 };
}
function kneeMiter(a, b) {
  const sum = { x: a.x + b.x, y: a.y + b.y };
  const magnitude = Math.hypot(sum.x, sum.y);
  if (magnitude < .1) return a;
  const unit = { x: sum.x / magnitude, y: sum.y / magnitude };
  const scale = Math.min(1.6, 1 / Math.max(.1, unit.x * a.x + unit.y * a.y));
  return { x: unit.x * scale, y: unit.y * scale };
}

function averageDepth(triangle) { return triangle.reduce((sum, point) => sum + (point.z || 0), 0) / 3; }
