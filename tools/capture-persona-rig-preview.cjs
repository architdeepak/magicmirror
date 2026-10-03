// Visual gate for the production GLB before it is allowed to replace FaceHost.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs/promises');

app.disableHardwareAcceleration();
const persona = process.argv.find((argument) => ['velora', 'solenne', 'rowan'].includes(argument)) || 'velora';
const label = persona === 'solenne' ? 'snow-3d-rig-gate' : `${persona}-3d-rig-gate`;
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1080, height: 1920, show: false,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false }
  });
  try {
    await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
    await new Promise((resolve) => setTimeout(resolve, 3500));
    const result = await win.webContents.executeJavaScript(`(async () => {
      document.querySelector('[data-mode="portal"]')?.click();
      const avatar = window.__mirrorDebug?.avatar;
      // Exercise the in-house renderer itself, not TalkingHead's debug view.
      // This capture is deliberately opt-in: it is a promotion gate, not the
      // normal customer-facing host.
      await avatar?.rigHost?.setPersona(${JSON.stringify(persona)});
      if (avatar?.faceHost?.canvas) avatar.faceHost.canvas.style.display = 'none';
      if (avatar?.rigHost?.canvas) avatar.rigHost.canvas.style.display = 'block';
      avatar?.setSpeechLevel(.7);
      return JSON.stringify({
        rig: avatar?.rigHost?.ready,
        rigCamera: avatar?.rigHost?.camera?.position.toArray(),
        host: { width: avatar?.host?.clientWidth, height: avatar?.host?.clientHeight, visibility: avatar?.host ? getComputedStyle(avatar.host).visibility : 'missing' },
        canvases: [...(avatar?.host?.querySelectorAll('canvas') || [])].map((canvas) => ({
          className: canvas.className, display: getComputedStyle(canvas).display,
          width: canvas.width, height: canvas.height, style: canvas.getAttribute('style')
        }))
      });
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 2400));
    const image = await win.webContents.capturePage();
    const output = path.join(__dirname, '..', 'artifacts', `${label}.png`);
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, image.toPNG());
    console.log(result, output);
  } finally { app.quit(); }
}).catch((error) => { console.error(error); app.exit(1); });
