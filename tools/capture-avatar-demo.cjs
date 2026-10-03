// Creates two short, captioned visual proofs of the center-stage hosts.
// It is intentionally offscreen so it works from Remote SSH without a display.
const { app, BrowserWindow } = require('electron');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs/promises');

app.disableHardwareAcceleration();

const root = path.join(__dirname, '..');
const outputDir = path.join(root, 'artifacts', 'avatar-demos');
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function setStage(win, persona, label, line) {
  await win.webContents.executeJavaScript(`(async () => {
    document.querySelector('[data-mode="portal"]')?.click();
    await window.__mirrorDebug?.avatar?.setPersona(${JSON.stringify(persona)});
    const card = document.querySelector('#oracle-card');
    card?.classList.remove('empty');
    const eyebrow = document.querySelector('#oracle-eyebrow');
    if (eyebrow) eyebrow.textContent = ${JSON.stringify(`${label} · speaking`)};
    const text = document.querySelector('#oracle-text');
    if (text) text.textContent = ${JSON.stringify(line)};
  })()`);
  await delay(450);
}

async function captureClip(win, { persona, label, line, name }) {
  const frames = 54;
  const fps = 12;
  const frameDir = path.join(outputDir, `${name}-frames`);
  await fs.rm(frameDir, { recursive: true, force: true });
  await fs.mkdir(frameDir, { recursive: true });
  await setStage(win, persona, label, line);

  for (let frame = 0; frame < frames; frame += 1) {
    const time = frame / fps;
    // A phrase-like envelope lets the generated speaking frame appear between
    // small rests, while gaze moves subtly between the viewer and each side.
    const syllable = Math.max(0, Math.sin(time * 10.7) * .72 + Math.sin(time * 5.2) * .28);
    const speech = .11 + syllable * .84;
    const gazeX = .14 * Math.exp(-Math.pow((time - .9) / .38, 2)) - .12 * Math.exp(-Math.pow((time - 2.35) / .42, 2));
    const gazeY = -.07 * Math.exp(-Math.pow((time - 2.0) / .35, 2));
    const blink = (frame === 18 || frame === 43) ? .78 : 0;
    const viseme = ['rest', 'AA', 'O', 'AA', 'rest', 'AA', 'O'][frame % 7];
    const turn = .22 * Math.exp(-Math.pow((time - .95) / .48, 2)) - .13 * Math.exp(-Math.pow((time - 2.2) / .5, 2)) + .10 * Math.exp(-Math.pow((time - 3.5) / .55, 2));
    const lean = -.07 * Math.exp(-Math.pow((time - 1.0) / .62, 2)) + .055 * Math.exp(-Math.pow((time - 3.1) / .7, 2));
    // A single deliberate nod with a tiny settle—never a repeating bounce.
    const nod = -Math.exp(-Math.pow((time - 2.05) / .20, 2)) * .34
      + Math.exp(-Math.pow((time - 2.38) / .16, 2)) * .10;
    const brow = frame % 14 < 7 ? .46 : .12;
    await win.webContents.executeJavaScript(`(() => {
      const avatar = window.__mirrorDebug?.avatar;
      avatar?.setSpeechLevel(${speech.toFixed(3)});
      avatar?.setEyeGaze({ x: ${gazeX.toFixed(3)}, y: ${gazeY.toFixed(3)}, confidence: 1 });
      avatar?.setViseme(${JSON.stringify(viseme)});
      avatar?.setPerformance({ turn: ${turn.toFixed(3)}, lean: ${lean.toFixed(3)}, nod: ${nod.toFixed(3)} });
      avatar?.setExpression({ eyeBlinkLeft: ${blink}, eyeBlinkRight: ${blink}, browInnerUp: ${brow.toFixed(3)}, browOuterUpRight: ${(1 - brow * .55).toFixed(3)} });
    })()`);
    await delay(1000 / fps);
    const image = await win.webContents.capturePage();
    await fs.writeFile(path.join(frameDir, `frame-${String(frame).padStart(4, '0')}.png`), image.toPNG());
  }

  const mp4 = path.join(outputDir, `${name}-talking-demo.mp4`);
  const ffmpeg = process.env.FFMPEG_PATH || '/home/addeepak/.local/bin/ffmpeg';
  const encoded = spawnSync(ffmpeg, [
    '-y', '-framerate', String(fps), '-i', path.join(frameDir, 'frame-%04d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4
  ], { encoding: 'utf8' });
  if (encoded.status !== 0) throw new Error(`ffmpeg failed: ${encoded.stderr}`);
  await fs.rm(frameDir, { recursive: true, force: true });
  console.log(mp4);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1080, height: 1920, show: false,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false }
  });
  try {
    await fs.mkdir(outputDir, { recursive: true });
    await win.loadFile(path.join(root, 'src', 'index.html'));
    await delay(3500);
    await captureClip(win, {
      persona: 'velora', label: 'Evil Queen', name: 'evil-queen',
      line: 'Mirror, mirror—your evening begins exactly when you choose.'
    });
    await captureClip(win, {
      persona: 'solenne', label: 'Snow', name: 'snow',
      line: 'Hello! Your day is looking bright. Shall we see what is next?'
    });
  } finally {
    app.quit();
  }
}).catch((error) => { console.error(error); app.exit(1); });
