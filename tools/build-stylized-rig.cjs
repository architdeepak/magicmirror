// Non-interactive exporter for the local face-to-blendshape lab.
// Usage: electron tools/build-stylized-rig.cjs <source.png> <output.glb>
const { app, BrowserWindow } = require('electron');
const fs = require('fs/promises');
const path = require('path');

// Electron's Chromium flags may be retained in argv, so the two positional
// paths are always read from the end rather than from a fixed offset.
const [source, output] = process.argv.slice(-2);
if (!source || !output) throw new Error('Usage: build-stylized-rig.cjs <source.png> <output.glb>');

const waitFor = async (check, timeout = 90000, label = 'condition') => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for the face-rig lab: ${label}`);
};

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const image = await fs.readFile(source);
  const imageData = image.toString('base64');
  await fs.mkdir(path.dirname(output), { recursive: true });
  const win = new BrowserWindow({ width: 1280, height: 960, show: false, webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false } });
  try {
    console.log('Loading face-rig lab…');
    await win.loadURL('http://127.0.0.1:8790/');
    await waitFor(() => win.webContents.executeJavaScript("Boolean(document.querySelector('#fileInput') && !document.querySelector('#processBtn').disabled)"), 1000).catch(() => {});
    await win.webContents.executeJavaScript(`(() => {
      const raw = atob('${imageData}'); const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      const input = document.querySelector('#fileInput'); const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], 'portrait.png', { type: 'image/png' }));
      input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    console.log('Waiting for face landmarks…');
    await waitFor(() => win.webContents.executeJavaScript("!document.querySelector('#processBtn').disabled"), 90000, 'landmarker initialization');
    console.log('Generating mesh and ARKit targets…');
    await win.webContents.executeJavaScript("document.querySelector('#processBtn').click()");
    await waitFor(() => win.webContents.executeJavaScript("!document.querySelector('#exportBtn').disabled"), 90000, 'mesh generation');
    console.log('Exporting GLB…');
    const dataUrl = await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const lab = window.__faceRigLab;
      if (!lab) return reject(new Error('Face-rig lab instance was unavailable'));
      lab.saveArrayBuffer = (buffer) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(new Blob([buffer], { type: 'application/octet-stream' }));
      };
      lab.exportGLB();
    })`);
    await fs.writeFile(output, Buffer.from(dataUrl.split(',')[1], 'base64'));
    const stat = await fs.stat(output);
    if (stat.size < 100000) throw new Error(`Export unexpectedly small: ${stat.size} bytes`);
    console.log(`Exported ${output} (${stat.size} bytes)`);
  } finally { win.destroy(); app.quit(); }
}).catch((error) => { console.error(error); app.exit(1); });
