// Reuse the live renderer rather than starting a second microphone/avatar.
// The native window region removes the upper page from both drawing and input.
class NativeCompanion {
  constructor({ getWindow, screen, platform = process.platform, sessionType = process.env.XDG_SESSION_TYPE, onChange = () => {}, onInvalidate = () => {} }) {
    Object.assign(this, { getWindow, screen, platform, sessionType, onChange, onInvalidate });
    this.active = false;
    this.label = '';
    this.saved = null;
  }
  supported() {
    const win = this.getWindow();
    return ['win32', 'linux'].includes(this.platform) && this.sessionType !== 'wayland'
      && Boolean(win && !win.isDestroyed() && typeof win.setShape === 'function');
  }
  presentation() { return { active: this.active, kind: this.active ? 'native' : null, label: this.label }; }
  enter(label = 'Desktop app') {
    if (!this.supported()) return false;
    const win = this.getWindow();
    if (!this.active) {
      this.saved = { bounds: win.getBounds(), fullscreen: win.isFullScreen(), kiosk: win.isKiosk(), maximized: win.isMaximized(), top: win.isAlwaysOnTop() };
      this.active = true;
      try {
        win.setKiosk(false);
        win.setFullScreen(false);
        if (win.isMaximized()) win.unmaximize();
        win.setBounds(this.screen.getDisplayMatching(this.saved.bounds).bounds);
        win.setAlwaysOnTop(true, 'pop-up-menu');
        this.layout();
        win.showInactive();
      } catch (error) { this.exit(); throw error; }
    }
    this.label = label;
    this.onChange();
    return true;
  }
  exposedBounds() {
    const win = this.getWindow();
    if (!this.active || !win || win.isDestroyed()) return null;
    const content = win.getContentBounds();
    const width = Math.min(content.width, content.height * 9 / 16);
    const height = Math.min(content.height, content.width * 16 / 9);
    return { x: content.x + (content.width - width) / 2, y: content.y + (content.height - height) / 2, width, height: height * .68 };
  }
  layout() {
    const win = this.getWindow();
    if (!this.active || !win || win.isDestroyed()) return;
    const outer = win.getBounds(); const content = win.getContentBounds();
    const width = Math.min(content.width, content.height * 9 / 16);
    const height = Math.min(content.height, content.width * 16 / 9);
    const left = content.x - outer.x + (content.width - width) / 2;
    const top = content.y - outer.y + (content.height - height) / 2;
    const cut = Math.floor(top + height * .68);
    win.setShape([{ x: Math.round(left), y: cut, width: Math.round(width), height: Math.ceil(top + height) - cut }]);
    this.onInvalidate();
  }
  exit() {
    if (!this.active) return;
    const win = this.getWindow(); const saved = this.saved;
    this.active = false; this.saved = null; this.label = '';
    if (win && !win.isDestroyed()) {
      win.setShape([]);
      win.setAlwaysOnTop(Boolean(saved?.top));
      if (saved) {
        win.setBounds(saved.bounds);
        if (saved.maximized) win.maximize();
        win.setFullScreen(saved.fullscreen);
        win.setKiosk(saved.kiosk);
      }
      win.show(); win.focus();
    }
    this.onInvalidate(); this.onChange();
  }
}
module.exports = { NativeCompanion };
