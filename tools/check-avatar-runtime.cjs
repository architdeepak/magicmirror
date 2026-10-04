// Hidden local render check. Does not start a live AI session.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs/promises');
app.disableHardwareAcceleration();
const timeout = setTimeout(() => { console.error('Avatar runtime check timed out'); app.exit(1); }, 45000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1080, height: 1920, show: false,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false } });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await win.webContents.executeJavaScript('Boolean(window.__mirrorDebug?.avatar?.faceHost)')) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  const result = await win.webContents.executeJavaScript(`(async () => {
    const avatar = window.__mirrorDebug.avatar;
    const previous = avatar.visualStyle;
    avatar.setDepthEnabled(false);
    document.querySelector('[data-persona="velora"]').click();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    const style = document.querySelector('#avatar-style');
    style.value = 'memoji'; style.dispatchEvent(new Event('change'));
    if (getComputedStyle(avatar.memojiHost.svg).display === 'none') throw Error('Memoji is hidden');
    avatar.setConversationState('thinking');
    await new Promise(resolve => setTimeout(resolve, 300));
    const thinking = avatar.memojiHost.parts.pupils[0].getAttribute('transform');
    avatar.setConversationState('speaking'); avatar.setSpeechLevel(.8); avatar.setViseme('AA');
    avatar.update(1/60, 1, {x:0,y:0});
    const mouth = Number(avatar.memojiHost.parts.mouth.getAttribute('ry'));
    avatar.resetSpeech(); avatar.setConversationState('ready');
    for (let i=0;i<100;i++) avatar.update(1/60, i/60, {x:0,y:0});
    const closed = Number(avatar.memojiHost.parts.mouth.getAttribute('ry'));
    if (!(mouth > closed + 3)) throw Error('Mouth failed to close: ' + JSON.stringify({mouth, closed, visible: avatar.visible}));
    avatar.setDepthEnabled(true);
    if (getComputedStyle(avatar.memojiHost.svg).display !== 'none') throw Error('Depth should retain canvas host');
    avatar.setDepthEnabled(false); avatar.setVisualStyle(previous);
    return { thinking, mouth, closed, localHostReady: avatar.faceHost.ready };
  })()`);
  console.log('Avatar runtime passed:', JSON.stringify(result));
  // Capture the selected animated host for visual review.
  await win.webContents.executeJavaScript("window.dispatchEvent(new KeyboardEvent('keydown', {key: '1'})); window.__mirrorDebug.avatar.setVisualStyle('memoji'); window.__mirrorDebug.avatar.setConversationState('listening')");
  await new Promise(resolve => setTimeout(resolve, 300));
  const output = path.join(app.getPath('temp'), 'magicmirror-memoji-preview.png');
  await fs.writeFile(output, (await win.webContents.capturePage()).toPNG());
  console.log(output);
  clearTimeout(timeout); app.quit();
}).catch(error => { console.error(error); clearTimeout(timeout); app.exit(1); });
