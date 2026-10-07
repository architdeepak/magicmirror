let landmarker = null;
let delegate = 'GPU';
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      const { FilesetResolver, FaceLandmarker } = await import('../node_modules/@mediapipe/tasks-vision/vision_bundle.mjs');
      const vision = await FilesetResolver.forVisionTasks(new URL('../node_modules/@mediapipe/tasks-vision/wasm', self.location.href).href);
      try {
        const probe = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1).getContext('webgl2') : null;
        const extension = probe?.getExtension('WEBGL_debug_renderer_info');
        const renderer = extension ? probe.getParameter(extension.UNMASKED_RENDERER_WEBGL) : '';
        if (!probe || /swiftshader|llvmpipe|softpipe|software/i.test(renderer)) delegate = 'CPU';
        probe?.getExtension('WEBGL_lose_context')?.loseContext();
      } catch { delegate = 'CPU'; }
      const options = { baseOptions: {
        modelAssetPath: new URL('./assets/models/face_landmarker.task', self.location.href).href, delegate },
        runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
        minFaceDetectionConfidence: .55, minFacePresenceConfidence: .55, minTrackingConfidence: .5 };
      try { landmarker = await FaceLandmarker.createFromOptions(vision, options); }
      catch { delegate = 'CPU'; options.baseOptions.delegate = delegate; landmarker = await FaceLandmarker.createFromOptions(vision, options); }
      self.postMessage({ type: 'ready', delegate });
    } catch (error) { self.postMessage({ type: 'error', message: `Face tracker unavailable: ${error.message}` }); }
  } else if (data.type === 'frame') {
    let result;
    try {
      if (!landmarker) throw new Error('Face tracker is not ready.');
      const started = performance.now(); result = landmarker.detectForVideo(data.frame, data.timestamp);
      self.postMessage({ type: 'face', requestId: data.requestId, epoch: data.epoch, timestamp: data.timestamp,
        landmarks: result.faceLandmarks?.[0] || null, matrix: result.facialTransformationMatrixes?.[0]?.data || null,
        blendshapes: result.faceBlendshapes?.[0]?.categories || [], inferenceMs: performance.now() - started });
    } catch (error) { self.postMessage({ type: 'error', message: `Face tracker failed: ${error.message}` }); }
    finally { result?.close?.(); data.frame.close(); }
  }
};
