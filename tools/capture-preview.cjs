// Offscreen Electron renderer for design review on a remote host.
// Usage: ./node_modules/.bin/electron tools/capture-preview.cjs
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs/promises');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: Number(process.env.MIRROR_CAPTURE_WIDTH) || 1080,
    height: Number(process.env.MIRROR_CAPTURE_HEIGHT) || 1920,
    show: false,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false }
  });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  if (process.argv.includes('cube')) {
    await win.webContents.executeJavaScript("localStorage.setItem('mirror.depth-cube', 'true'); location.reload()");
  }
  await new Promise((resolve) => setTimeout(resolve, 7000));

  // Capture a proof-friendly sequence: Converse mode, then deliberately
  // different lip-sync intensities. This runs entirely in the page so it is
  // usable from a headless SSH session too.
  await win.webContents.executeJavaScript(`
    // Converse is persona-led: selecting a host brings it forward.
    document.querySelector('#persona-list [data-persona="velora"]')?.click();
    if (${process.argv.includes('cube')}) document.querySelector('[data-depth="cube"]')?.click();
    window.__mirrorDebug?.avatar?.setSpeechLevel(.18);
  `);
  if (await win.webContents.executeJavaScript('document.querySelector("#app-shell").dataset.mode') !== 'portal') throw new Error('Avatar preview did not enter Converse');
  console.log('avatar:', await win.webContents.executeJavaScript('JSON.stringify({ rig: window.__mirrorDebug?.avatar?.loadedRigUrl, error: window.__mirrorDebug?.avatar?.lastRigError })'));
  await new Promise((resolve) => setTimeout(resolve, 700));
  for (const [name, level] of [['idle', .08], ['talking', .82], ['emphasis', 1]]) {
    await win.webContents.executeJavaScript(`window.__mirrorDebug?.avatar?.setSpeechLevel(${level})`);
    await new Promise((resolve) => setTimeout(resolve, 180));
    const image = await win.webContents.capturePage();
    const output = path.join(__dirname, '..', `mirror-preview-animoji-${name}.png`);
    await fs.writeFile(output, image.toPNG());
    console.log(output);
  }
  // Keep a second host proof alongside the default host so persona asset
  // changes can be reviewed from an SSH session without a desktop display.
  await win.webContents.executeJavaScript(`(async () => {
    await window.__mirrorDebug?.avatar?.setPersona('solenne');
    window.__mirrorDebug?.avatar?.setSpeechLevel(.82);
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 320));
  const snowImage = await win.webContents.capturePage();
  const snowOutput = path.join(__dirname, '..', 'mirror-preview-snow-talking.png');
  await fs.writeFile(snowOutput, snowImage.toPNG());
  console.log(snowOutput);
  app.quit();
});
