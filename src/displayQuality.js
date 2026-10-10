// Pixel and cadence limits are explicit; a profile never invents source detail.
export const DISPLAY_PROFILES = Object.freeze({
  // Efficient targets a fanless dual/quad-core stick driving a 4K panel: the
  // heavy canvases render near 720p and are scaled by the compositor.
  eco: { name: 'Efficient', motionFps: 30, fogFps: 20, fogPixels: 450_000, fogSlices: 3, avatarPixels: 1_000_000, avatarDpr: 1, featureDetail: 1, depthTexture: 768 },
  auto: { name: 'Balanced', motionFps: 60, fogFps: 60, fogPixels: 1_600_000, fogSlices: 4, avatarPixels: 3_000_000, avatarDpr: 2, featureDetail: 1.35, depthTexture: 1536 },
  hd: { name: 'Maximum detail', motionFps: 60, fogFps: 60, fogPixels: 4_000_000, fogSlices: 6, avatarPixels: 4_000_000, avatarDpr: 3, featureDetail: 1.8, depthTexture: 2048 }
});
export function displayProfile(id) { return DISPLAY_PROFILES[id] || DISPLAY_PROFILES.auto; }
export function boundedSurface(width, height, dpr, pixels, maxDpr = 3) {
  const w = Math.max(1,Number(width)||1),h = Math.max(1,Number(height)||1);
  const scale = Math.min(Math.max(1,Number(dpr)||1),maxDpr,Math.sqrt(pixels/(w*h)));
  return { width: Math.max(1,Math.floor(w*scale)),height:Math.max(1,Math.floor(h*scale)),scale };
}
