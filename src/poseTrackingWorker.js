// A classic worker permits MediaPipe's WASM loader to use importScripts. The
// application import map does not apply inside workers, hence the direct URL.
let landmarker = null;
let segmenter = null;
let segmentationNotice = '';
let segmentationDelegate = 'GPU';
let segmentationFrames = 0;
let slowFrames = 0;
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      const { FilesetResolver, PoseLandmarker, ImageSegmenter } = await import('../node_modules/@mediapipe/tasks-vision/vision_bundle.mjs');
      const vision = await FilesetResolver.forVisionTasks(new URL('../node_modules/@mediapipe/tasks-vision/wasm', self.location.href).href);
      const options = {
        baseOptions: {
          modelAssetPath: new URL('./assets/models/pose_landmarker_lite.task', self.location.href).href,
          delegate: 'GPU'
        },
        runningMode: 'VIDEO', numPoses: 1,
        minPoseDetectionConfidence: .65, minPosePresenceConfidence: .65,
        minTrackingConfidence: .6, outputSegmentationMasks: false
      };
      try { landmarker = await PoseLandmarker.createFromOptions(vision, options); }
      catch { options.baseOptions.delegate = 'CPU'; landmarker = await PoseLandmarker.createFromOptions(vision, options); }
      try {
        if (typeof OffscreenCanvas !== 'undefined') {
          const probe = new OffscreenCanvas(1, 1).getContext('webgl2');
          const extension = probe?.getExtension('WEBGL_debug_renderer_info');
          const renderer = extension ? probe.getParameter(extension.UNMASKED_RENDERER_WEBGL) : '';
          if (!probe || /swiftshader|llvmpipe|softpipe|software/i.test(renderer)) segmentationDelegate = 'CPU';
          probe?.getExtension('WEBGL_lose_context')?.loseContext();
        }
        const segmentationOptions = {
          baseOptions: { modelAssetPath: new URL('./assets/models/selfie_multiclass_256x256.tflite', self.location.href).href, delegate: segmentationDelegate },
          runningMode: 'VIDEO', outputCategoryMask: true, outputConfidenceMasks: false
        };
        try { segmenter = await ImageSegmenter.createFromOptions(vision, segmentationOptions); }
        catch { segmentationDelegate = 'CPU'; segmentationOptions.baseOptions.delegate = 'CPU'; segmenter = await ImageSegmenter.createFromOptions(vision, segmentationOptions); }
        const labels = segmenter.getLabels();
        if (labels[1] !== 'hair' || labels[2] !== 'body-skin' || labels[3] !== 'face-skin') throw new Error('Unexpected body segmentation labels.');
      } catch {
        segmenter?.close(); segmenter = null;
        segmentationNotice = 'Detailed arm occlusion unavailable · using pose approximation';
      }
      self.postMessage({ type: 'ready', segmentationAvailable: Boolean(segmenter), segmentationNotice });
    } catch (error) { self.postMessage({ type: 'error', message: `Body tracker unavailable: ${error.message}` }); }
    return;
  }
  if (data.type === 'frame') {
    let result, segmentationResult;
    try {
      if (!landmarker) throw new Error('Body tracker is not ready.');
      const started = performance.now();
      const usedSegmentationDelegate = segmentationDelegate;
      result = landmarker.detectForVideo(data.frame, data.timestamp);
      let segmentation = null;
      if (segmenter && result.landmarks?.[0]) {
        try {
          segmentationResult = segmenter.segmentForVideo(data.frame, data.timestamp);
          const mask = segmentationResult.categoryMask;
          if (mask) segmentation = { width: mask.width, height: mask.height, classes: mask.getAsUint8Array().slice() };
        } catch {
          segmenter.close(); segmenter = null;
          self.postMessage({ type: 'occlusion-unavailable', message: 'Detailed arm occlusion unavailable · using pose approximation' });
        }
      }
      const inferenceMs = performance.now() - started;
      if (segmentation) {
        segmentationFrames += 1;
        slowFrames = segmentationFrames > 1 && inferenceMs > 280 ? slowFrames + 1 : 0;
        if (slowFrames >= 3) {
          // A successfully created GPU can still be a slow software renderer.
          // Try CPU inference before sacrificing detailed occlusion.
          segmentationResult?.close(); segmentationResult = null;
          if (segmentationDelegate === 'GPU') {
            try {
              await segmenter.setOptions({ baseOptions: { delegate: 'CPU' } });
              segmentationDelegate = 'CPU'; segmentationFrames = 0; slowFrames = 0;
            } catch { segmenter.close(); segmenter = null; }
          } else { segmenter.close(); segmenter = null; }
          if (!segmenter) {
            segmentation = null;
            self.postMessage({ type: 'occlusion-unavailable', message: 'Detailed occlusion is too slow on this device · using pose approximation' });
          }
        }
      }
      self.postMessage({ type: 'pose', requestId: data.requestId, epoch: data.epoch, timestamp: data.timestamp, landmarks: result.landmarks?.[0] || null, segmentation, inferenceMs, segmentationDelegate: usedSegmentationDelegate }, segmentation ? [segmentation.classes.buffer] : []);
    } catch (error) { self.postMessage({ type: 'error', message: `Body tracker failed: ${error.message}` }); }
    finally { segmentationResult?.close(); result?.close(); data.frame.close(); }
  }
};
