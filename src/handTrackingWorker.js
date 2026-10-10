let landmarker = null;
let delegate = 'GPU';
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      const { FilesetResolver, HandLandmarker } = await import('../node_modules/@mediapipe/tasks-vision/vision_bundle.mjs');
      const vision = await FilesetResolver.forVisionTasks(new URL('../node_modules/@mediapipe/tasks-vision/wasm', self.location.href).href);
      try {
        const probe = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1).getContext('webgl2') : null;
        const extension = probe?.getExtension('WEBGL_debug_renderer_info');
        const renderer = extension ? probe.getParameter(extension.UNMASKED_RENDERER_WEBGL) : '';
        if (!probe || /swiftshader|llvmpipe|softpipe|software/i.test(renderer)) delegate = 'CPU';
        probe?.getExtension('WEBGL_lose_context')?.loseContext();
      } catch { delegate = 'CPU'; }
      const options = { baseOptions: {
        modelAssetPath: new URL('./assets/models/hand_landmarker.task', self.location.href).href, delegate },
        runningMode: 'VIDEO', numHands: 1, minHandDetectionConfidence: .7, minHandPresenceConfidence: .7, minTrackingConfidence: .65 };
      try { landmarker = await HandLandmarker.createFromOptions(vision, options); }
      catch { delegate = 'CPU'; options.baseOptions.delegate = delegate; landmarker = await HandLandmarker.createFromOptions(vision, options); }
      self.postMessage({ type: 'ready', delegate });
    } catch (error) { self.postMessage({ type: 'error', message: `Hand tracker unavailable: ${error.message}` }); }
  } else if (data.type === 'frame') {
    let result;
    try {
      if (!landmarker) throw new Error('Hand tracker is not ready.');
      const started = performance.now(); result = landmarker.detectForVideo(data.frame, data.timestamp);
      self.postMessage({ type: 'hand', requestId: data.requestId, epoch: data.epoch, timestamp: data.timestamp,
        landmarks: result.landmarks?.[0] || null, inferenceMs: performance.now() - started });
    } catch (error) { self.postMessage({ type: 'error', message: `Hand tracker failed: ${error.message}` }); }
    finally { result?.close?.(); data.frame.close(); }
  }
};
