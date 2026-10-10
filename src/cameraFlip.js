// Upside-down camera support. When enabled, video-only camera streams are
// redrawn rotated 180° so every consumer (face/body/hand tracking, display,
// assistant vision) sees an upright picture. Must load before the app.
(() => {
  let enabled = false;
  try { enabled = localStorage.getItem('mirror.camera-flip') === 'true'; } catch {}
  const devices = navigator.mediaDevices;
  if (!enabled || !devices?.getUserMedia) return;
  const original = devices.getUserMedia.bind(devices);
  devices.getUserMedia = async constraints => {
    const source = await original(constraints);
    if (!constraints?.video || constraints.audio || !source.getVideoTracks().length) return source;
    const video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.srcObject = source;
    try { await video.play(); } catch (error) { source.getTracks().forEach(track => track.stop()); throw error; }
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });
    let live = true, handle = 0;
    const draw = () => {
      if (!live) return;
      if (video.videoWidth && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; }
      if (canvas.width) { context.setTransform(-1, 0, 0, -1, canvas.width, canvas.height); context.drawImage(video, 0, 0); }
      handle = video.requestVideoFrameCallback ? video.requestVideoFrameCallback(draw) : requestAnimationFrame(draw);
    };
    draw();
    const output = canvas.captureStream(30);
    const shutdown = () => {
      if (!live) return; live = false;
      if (video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(handle); else cancelAnimationFrame(handle);
      source.getTracks().forEach(track => track.stop()); video.srcObject = null;
    };
    for (const track of output.getVideoTracks()) {
      const stop = track.stop.bind(track);
      track.stop = () => { stop(); shutdown(); };
    }
    source.getVideoTracks()[0].addEventListener('ended', () => { for (const track of output.getVideoTracks()) { track.stop(); track.dispatchEvent(new Event('ended')); } });
    return output;
  };
})();
