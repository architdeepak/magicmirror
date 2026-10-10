export function applyClothingMask(source, mask) {
  const { width, height } = source;
  if (!mask.width || !mask.height || mask.classes.length !== mask.width * mask.height) throw new Error('Invalid clothing mask.');
  const data = new Uint8ClampedArray(source.data);
  let selected = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = y * width + x;
    const mx = Math.min(mask.width - 1, Math.floor(x * mask.width / width));
    const my = Math.min(mask.height - 1, Math.floor(y * mask.height / height));
    if (mask.classes[my * mask.width + mx] !== 4) data[p * 4 + 3] = 0;
    else if (data[p * 4 + 3] > 16) selected++;
  }
  if (selected < width * height * .03) throw new Error('Not enough clothing found. Use a clear front photo, or lay the garment flat.');
  return { width, height, data };
}

export function extractPhotoClothing(source) {
  let worker, timer, settled = false, rejectJob;
  const finish = () => { clearTimeout(timer); worker?.terminate(); worker = null; };
  const promise = new Promise((resolve, reject) => {
    rejectJob = reject;
    timer = setTimeout(() => { settled = true; finish(); reject(new Error('Clothing extraction took too long. Try a flat garment photo.')); }, 30000);
    (async () => {
      const frame = await createImageBitmap(new ImageData(source.data, source.width, source.height));
      if (settled) { frame.close(); return; }
      worker = new Worker(new URL('./photoClothingWorker.js', import.meta.url));
      worker.onmessage = ({ data }) => {
        settled = true; finish();
        if (data.error) { reject(new Error(data.error)); return; }
        try { resolve({ source: applyClothingMask(source, data), inferenceMs: data.inferenceMs }); }
        catch (error) { reject(error); }
      };
      worker.onerror = () => { settled = true; finish(); reject(new Error('Clothing extraction unavailable. Use a flat garment photo.')); };
      try { worker.postMessage({ frame }, [frame]); } catch (error) { frame.close(); throw error; }
    })().catch(error => { if (!settled) { settled = true; finish(); reject(error); } });
  });
  return { promise, cancel() { if (!settled) { settled = true; finish(); rejectJob(new Error('Photo changed.')); } } };
}
