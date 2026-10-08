// Actual local rendering of recorded camera imagery, not a physical-camera audit.
const { app, BrowserWindow } = require('electron');
const fs = require('fs/promises'), path = require('path'), assert = require('assert/strict');
const { pathToFileURL } = require('url');
app.disableHardwareAcceleration();
const root = path.resolve(__dirname, '..');
app.whenReady().then(async () => {
  const dir = path.join(root, 'artifacts/camera-clarity'); await fs.mkdir(dir, { recursive: true });
  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false } });
  try {
    await win.loadFile(path.join(root, 'src/index.html'));
    const result = await win.webContents.executeJavaScript(`(async () => {
      const { CameraClarity } = await import('./cameraClarity.js');
      const video = document.createElement('video'); video.muted = true;
      video.src = ${JSON.stringify(pathToFileURL(path.join(root, 'artifacts/rtv/sample_video2.mp4')).href)};
      await video.play(); video.pause();
      const source = document.createElement('canvas'); source.width = 640; source.height = Math.round(640 * video.videoHeight / video.videoWidth);
      source.getContext('2d').drawImage(video, 0, 0, source.width, source.height);
      const original = source.getContext('2d').getImageData(0, 0, source.width, source.height).data;
      const processor = new CameraClarity(document), costs = [], images = [];
      for (const mode of ['off', 'natural', 'bright']) {
        processor.setMode(mode); const output = processor.process(source);
        images.push({ mode, png: output.toDataURL() });
      }
      processor.setMode('natural');
      for (let i = 0; i < 40; i++) { processor.lastFrame = null; processor.process(source); costs.push(processor.lastCostMs); }
      const after = source.getContext('2d').getImageData(0, 0, source.width, source.height).data;
      const unchanged = original.every((value, i) => value === after[i]);
      processor.destroy(); video.src = ''; costs.sort((a,b) => a-b);
      return { images, sourceUnchanged: unchanged, width: source.width, height: source.height, medianMs: costs[20], p95Ms: costs[38], scope: 'Recorded public video in actual Electron, software rendering; no physical camera, TV glass, or wattage test.' };
    })()`);
    for (const shot of result.images) await fs.writeFile(path.join(dir, shot.mode + '.png'), Buffer.from(shot.png.split(',')[1], 'base64'));
    delete result.images; assert(result.sourceUnchanged); assert(result.p95Ms < 100, 'Enhancement exceeded tracking interval');
    await fs.writeFile(path.join(dir, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  } finally { win.destroy(); }
}).then(() => app.quit()).catch(error => { console.error(error); app.exit(1); });
