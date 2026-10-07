const { app, BrowserWindow } = require('electron');
const fs = require('fs/promises'), path = require('path'), assert = require('assert/strict');
const { pathToFileURL } = require('url');
app.disableHardwareAcceleration();
const root = path.resolve(__dirname, '..');
app.whenReady().then(async () => {
  const directory = path.join(root, 'artifacts/photo-clothing'); await fs.mkdir(directory, { recursive: true });
  const fixture = path.join(directory, 'fixture.html'); await fs.writeFile(fixture, '<!doctype html><body></body>');
  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false } });
  const results = [];
  try {
    await win.loadFile(fixture); win.webContents.session.enableNetworkEmulation({ offline: true });
    for (const [index, file] of ['artifacts/fashn/garment0.png', 'artifacts/fashn/person0.png'].entries()) {
      const url = 'data:image/png;base64,' + (await fs.readFile(path.join(root, file))).toString('base64');
      const result = await win.webContents.executeJavaScript(`(async () => {
        const { extractPhotoClothing } = await import(${JSON.stringify(pathToFileURL(path.join(root, 'src/photoClothing.js')).href)});
        const image = new Image(); image.src = ${JSON.stringify(url)}; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        const original = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const cancelled = extractPhotoClothing(original); cancelled.cancel();
        try { await cancelled.promise; throw new Error('Cancelled extraction resolved'); }
        catch (error) { if (error.message !== 'Photo changed.') throw error; }
        let beats = 0; const timer = setInterval(() => beats++, 25), start = performance.now();
        try {
          const result = await extractPhotoClothing(original).promise;
          let changedRGB = 0, removed = 0, kept = 0;
          for (let p = 0; p < original.data.length; p += 4) {
            for (let c = 0; c < 3; c++) if (original.data[p+c] !== result.source.data[p+c]) changedRGB++;
            if (result.source.data[p+3]) kept++; else removed++;
          }
          ctx.putImageData(new ImageData(result.source.data, canvas.width, canvas.height), 0, 0);
          return { inferenceMs: result.inferenceMs, totalMs: performance.now()-start, beats, changedRGB, removed, kept, png: canvas.toDataURL() };
        } finally { clearInterval(timer); }
      })()`);
      assert.equal(result.changedRGB, 0); assert(result.removed > 0 && result.kept > 0); assert(result.beats > 0);
      await fs.writeFile(path.join(directory, `${index}-cutout.png`), Buffer.from(result.png.split(',')[1], 'base64'));
      delete result.png; results.push({ file, ...result });
    }
    const report = { scope: 'Actual bundled offline CPU model in Electron worker; real photos, unchanged RGB, responsive UI. No physical camera or fit validation.', results };
    await fs.writeFile(path.join(directory, 'result.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  } finally { win.destroy(); }
}).then(() => app.quit()).catch(error => { console.error(error); app.exit(1); });
