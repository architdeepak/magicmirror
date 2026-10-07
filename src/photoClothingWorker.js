// One photo only. The editor terminates this worker after completion/cancellation.
self.onmessage = async ({ data }) => {
  let segmenter, result;
  try {
    const { FilesetResolver, ImageSegmenter } = await import('../node_modules/@mediapipe/tasks-vision/vision_bundle.mjs');
    const vision = await FilesetResolver.forVisionTasks(new URL('../node_modules/@mediapipe/tasks-vision/wasm', self.location.href).href);
    segmenter = await ImageSegmenter.createFromOptions(vision, {
      baseOptions: { modelAssetPath: new URL('./assets/models/selfie_multiclass_256x256.tflite', self.location.href).href, delegate: 'CPU' },
      runningMode: 'IMAGE', outputCategoryMask: true, outputConfidenceMasks: false
    });
    if (segmenter.getLabels()[4] !== 'clothes') throw new Error('Unexpected clothing model labels.');
    const started = performance.now();
    result = segmenter.segment(data.frame);
    const mask = result.categoryMask;
    if (!mask) throw new Error('No clothing mask returned.');
    const classes = mask.getAsUint8Array().slice();
    self.postMessage({ width: mask.width, height: mask.height, classes, inferenceMs: performance.now() - started }, [classes.buffer]);
  } catch (error) { self.postMessage({ error: error.message }); }
  finally { result?.close(); segmenter?.close(); data.frame.close(); }
};
