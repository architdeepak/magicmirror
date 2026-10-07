const usableVideo = video => Boolean(video?.srcObject && video.srcObject.active !== false && video.readyState >= 2 && video.videoWidth && video.videoHeight);

function drawVideo(context, video, width, height, mirrored, cover) {
  const scale = cover ? Math.max(width / video.videoWidth, height / video.videoHeight) : Math.min(width / video.videoWidth, height / video.videoHeight);
  const w = video.videoWidth * scale, h = video.videoHeight * scale;
  context.save();
  if (mirrored) { context.translate(width, 0); context.scale(-1, 1); }
  context.drawImage(video, (width - w) / 2, (height - h) / 2, w, h);
  context.restore();
}

// This captures the camera/try-on content, not the entire desktop. Desktop and
// app observations continue through the explicit see_screen tool.
export function selectAssistantVision({ mode, desktopActive, camera, cameraCanvas, neural, neuralState, view, still, garmentCanvas, effectCanvas, width, height }) {
  const fitting = mode === 'ar' && !desktopActive;
  if (fitting && neuralState?.active) {
    if (neuralState.state !== 'streaming' || neuralState.frameAgeMs == null || neuralState.frameAgeMs > 3000 || neural.hidden || !usableVideo(neural)) return null;
    return { kind: 'live-ai-try-on', width, height, draw: (context, w, h) => drawVideo(context, neural, w, h, true, true) };
  }
  if (fitting && view === 'rendered') {
    if (!still?.complete || !still.naturalWidth || !still.naturalHeight) return null;
    return { kind: 'rendered-try-on-still', width, height, draw: (context, w, h) => {
      const scale = Math.min(w / still.naturalWidth, h / still.naturalHeight);
      const iw = still.naturalWidth * scale, ih = still.naturalHeight * scale;
      context.fillStyle = '#000'; context.fillRect(0, 0, w, h);
      context.drawImage(still, (w - iw) / 2, (h - ih) / 2, iw, ih);
    } };
  }
  if (!usableVideo(camera)) return null;
  if (!fitting) return { kind: 'camera', width: camera.videoWidth, height: camera.videoHeight,
    draw: (context, w, h) => context.drawImage(camera, 0, 0, w, h) };
  return { kind: 'local-try-on', width, height, draw: (context, w, h) => {
    if (cameraCanvas?.style.display === 'block' && cameraCanvas.width && cameraCanvas.height) context.drawImage(cameraCanvas, 0, 0, w, h);
    else drawVideo(context, camera, w, h, true, true);
    for (const layer of [garmentCanvas, effectCanvas]) {
      if (layer?.width && layer.height) context.drawImage(layer, 0, 0, w, h);
    }
  } };
}
