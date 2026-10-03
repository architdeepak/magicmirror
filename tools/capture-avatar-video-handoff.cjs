// Offscreen proof that a generated-video feed takes complete ownership of the
// center host surface. Works from Remote SSH; no display server is required.
const { app, BrowserWindow } = require('electron');
const fs = require('fs/promises');
const path = require('path');

app.disableHardwareAcceleration();
const root = path.join(__dirname, '..');
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1080, height: 1920, show: false,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false }
  });
  try {
    await win.loadFile(path.join(root, 'src', 'index.html'));
    await delay(3500);
    const demoUrl = `file://${path.join(root, 'artifacts', 'avatar-demos', 'snow-talking-demo.mp4')}`;
    const state = await win.webContents.executeJavaScript(`(async () => {
      document.querySelector('[data-mode="portal"]')?.click();
      const avatar = window.__mirrorDebug?.avatar;
      await avatar?.setAvatarVideoUrl(${JSON.stringify(demoUrl)});
      await new Promise(resolve => setTimeout(resolve, 900));
      const video = document.querySelector('.avatar-video-host');
      return JSON.stringify({
        ...avatar?.getAvatarVideoStatus(),
        source: document.querySelector('#avatar-engine')?.dataset.avatarSource,
        paused: video?.paused
      });
    })()`);
    const target = path.join(root, 'artifacts', 'avatar-video-handoff.png');
    const image = await win.webContents.capturePage();
    await fs.writeFile(target, image.toPNG());
    console.log(state);
    console.log(target);
  } finally {
    app.quit();
  }
}).catch((error) => { console.error(error); app.exit(1); });
