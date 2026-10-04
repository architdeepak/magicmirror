const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

class MockContents extends EventEmitter {
  constructor() { super(); this.url = ''; this.muted = true; this.inputs = []; this.scripts = []; this.pendingLoad = null; }
  isDestroyed() { return false; }
  setAudioMuted(value) { this.muted = value; }
  setWindowOpenHandler(handler) { this.windowHandler = handler; }
  async loadURL(url) { this.url = url; if (this.pendingLoad) await this.pendingLoad; }
  getURL() { return this.url; }
  stop() { this.stopped = true; }
  executeJavaScript(script) { this.scripts.push(script); return Promise.resolve({ state: 'playing', playbackStarted: true }); }
  sendInputEvent(event) { this.inputs.push(event); }
  close() { this.closed = true; }
}
class MockView {
  constructor(options) { this.options = options; this.webContents = new MockContents(); }
  setBackgroundColor(color) { this.background = color; }
  setVisible(value) { this.visible = value; }
  setBounds(bounds) { this.bounds = bounds; }
  getBounds() { return this.bounds; }
}
const mediaSession = new EventEmitter();
mediaSession.setPermissionRequestHandler = callback => { mediaSession.permissionRequest = callback; };
mediaSession.setPermissionCheckHandler = callback => { mediaSession.permissionCheck = callback; };
const exportsObject = { exports: {} };
const source = fs.readFileSync(path.join(__dirname, '../src/mirrorMedia.js'), 'utf8');
vm.runInNewContext(source, { module: exportsObject, require: name => { assert.equal(name, 'electron'); return { WebContentsView: MockView, session: { fromPartition: name => { assert.equal(name, 'persist:mirror-media'); return mediaSession; } } }; }, URL, setTimeout, console });
const { MirrorMedia, allowedNavigation, clampBounds } = exportsObject.exports;

(async () => {
  assert.equal(allowedNavigation('https://open.spotify.com/collection/tracks', 'spotify'), true);
  assert.equal(allowedNavigation('https://accounts.spotify.com/en/login', 'spotify'), true);
  for (const url of ['http://open.spotify.com/', 'https://spotify.com.attacker.test/', 'file:///etc/passwd', 'javascript:alert(1)']) assert.equal(allowedNavigation(url, 'spotify'), false);
  assert.equal(JSON.stringify(clampBounds({ x: -5, y: 25, width: 900, height: 1000 }, { width: 540, height: 960 })), JSON.stringify({ x: 0, y: 25, width: 540, height: 935 }));
  assert.throws(() => clampBounds({ x: NaN, y: 0, width: 10, height: 10 }, { width: 540, height: 960 }));
  const win = new EventEmitter();
  win.webContents = new EventEmitter();
  win.contentView = { addChildView(view) { win.child = view; } };
  win.isDestroyed = () => false;
  win.getContentBounds = () => ({ width: 540, height: 960 });
  const controller = new MirrorMedia(win);
  const opened = await controller.open({ service: 'spotify', target: 'liked', bounds: { x: 40, y: 80, width: 460, height: 600 }, play: true });
  assert.equal(opened.playbackStarted, true);
  assert.equal(controller.view.webContents.url, 'https://open.spotify.com/collection/tracks');
  assert.equal(controller.view.options.webPreferences.nodeIntegration, false);
  assert.equal(controller.view.options.webPreferences.sandbox, true);
  assert.equal(controller.view.options.webPreferences.preload, undefined);
  assert.equal(mediaSession.permissionCheck(), false);
  assert.equal((await controller.pointer({ x: 50, y: 100, click: true })).hit, true);
  assert.equal(controller.view.webContents.inputs.map(event => event.type).join(','), 'mouseMove,mouseDown,mouseUp');
  assert.equal(controller.view.webContents.inputs[0].x, 10);
  assert.equal(controller.view.webContents.inputs[0].y, 20);
  assert.equal((await controller.pointer({ x: 10, y: 10, click: true })).hit, false);
  controller.hide();
  assert.equal(controller.view.visible, false);
  assert.equal(controller.view.webContents.muted, true);
  assert.equal((await controller.pointer({ x: 50, y: 100, click: true })).hit, false);
  assert.equal((await controller.control({ action: 'play' })).playbackStarted, false);
  let resolveLoad;
  controller.view.webContents.pendingLoad = new Promise(resolve => { resolveLoad = resolve; });
  const pending = controller.open({ service: 'spotify', target: 'liked', bounds: { x: 40, y: 80, width: 460, height: 600 }, play: true });
  controller.hide();
  resolveLoad();
  assert.equal((await pending).state, 'cancelled');
  assert.equal(controller.view.webContents.muted, true);
  console.log('Mirror media passed: secure navigation, bounds, embedded pointer input and immediate hide/cancellation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
