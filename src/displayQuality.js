// Pixel and cadence limits are explicit; a profile never invents source detail.
export const DISPLAY_PROFILES = Object.freeze({
  eco: { name: 'Efficient', motionFps: 30, fogFps: 30, fogPixels: 800_000, fogSlices: 4, avatarPixels: 1_500_000, avatarDpr: 2, featureDetail: 1, depthTexture: 1024 },
  auto: { name: 'Balanced', motionFps: 60, fogFps: 60, fogPixels: 1_500_000, fogSlices: 5, avatarPixels: 3_000_000, avatarDpr: 2, featureDetail: 1.35, depthTexture: 1536 },
  hd: { name: 'Maximum detail', motionFps: 60, fogFps: 60, fogPixels: 4_000_000, fogSlices: 6, avatarPixels: 4_000_000, avatarDpr: 3, featureDetail: 1.8, depthTexture: 2048 }
});
export function displayProfile(id) { return DISPLAY_PROFILES[id] || DISPLAY_PROFILES.auto; }
export function boundedSurface(width, height, dpr, pixels, maxDpr = 3) {
  const w = Math.max(1,Number(width)||1),h = Math.max(1,Number(height)||1);
  const scale = Math.min(Math.max(1,Number(dpr)||1),maxDpr,Math.sqrt(pixels/(w*h)));
  return { width: Math.max(1,Math.floor(w*scale)),height:Math.max(1,Math.floor(h*scale)),scale };
}
