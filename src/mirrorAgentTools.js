// Codex uses the same application callbacks as the live voice host. Native
// input still passes through the main process's one-use observation checks.
export class MirrorAgentTools {
  constructor(adapter) { this.adapter = adapter; this.cancel(); }
  cancel() { this.epoch = (this.epoch || 0) + 1; this.observation = null; this.lastClick = null; }
  async execute(name, args = {}) {
    const epoch = this.epoch;
    const current = () => { if (epoch !== this.epoch) throw new Error('Agent task cancelled.'); };
    current();
    const a = this.adapter;
    const observe = async () => {
      const capture = await a.onCaptureScreen(); current();
      let host = ''; try { host = new URL(capture.url || '').hostname.toLowerCase(); } catch {}
      if (host === 'spotify.com' || host.endsWith('.spotify.com')) throw new Error('Spotify content stays local.');
      if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(capture.dataUrl || '') || !capture.snapshotId || !Number.isFinite(capture.width) || !Number.isFinite(capture.height) || capture.width <= 0 || capture.height <= 0) throw new Error('No usable screen observation.');
      const { dataUrl, ...metadata } = capture;
      this.observation = { snapshotId: capture.snapshotId, width: capture.width, height: capture.height };
      return { imageUrl: dataUrl, observation: { ...metadata, coordinateSpace: 'normalized-1000' } };
    };
    let result;
    if (name === 'see_screen') result = await observe();
    else if (name === 'get_mirror_state') result = { mirrorState: a.onMirrorState() };
    else if (name === 'computer_action') {
      const input = { ...args };
      if (input.action !== 'close_browser') {
        const observation = this.observation;
        if (!observation || input.snapshotId !== observation.snapshotId) throw new Error('Observe again before each action.');
        this.observation = null;
        if (['click', 'double_click', 'scroll'].includes(input.action)) {
          if (![input.x, input.y].every(value => Number.isInteger(value) && value >= 0 && value <= 1000)) throw new Error('Use integer coordinates from 0 to 1000.');
          if (['click', 'double_click'].includes(input.action) && this.lastClick && Math.abs(input.x - this.lastClick.x) <= 12 && Math.abs(input.y - this.lastClick.y) <= 12) throw new Error('This location was already activated. Inspect the result before repeating an action.');
          input.x = Math.min(observation.width - 1, Math.floor(input.x / 1000 * observation.width));
          input.y = Math.min(observation.height - 1, Math.floor(input.y / 1000 * observation.height));
        }
      }
      current();
      const delivered = await a.onComputerAction(input); current();
      this.lastClick = ['click', 'double_click'].includes(input.action) ? { x: args.x, y: args.y } : null;
      result = { ...delivered, result: 'Input delivered; inspect the resulting image to verify success.' };
      try { await new Promise(resolve => setTimeout(resolve, 180)); current(); Object.assign(result, await observe()); }
      catch (error) { current(); result.observationError = error.message; }
    } else {
      const callbacks = {
        open_webpage: () => a.onOpenWebpage(args.url), search_web: () => a.onSearch(args.query),
        set_display_mode: () => a.onModeChange(args.mode), set_avatar_position: () => a.onAvatarPosition(args.position),
        wardrobe_command: () => a.onWardrobe(args), request_try_on: () => a.onTryOn(args)
      };
      if (!callbacks[name]) throw new Error('Tool unavailable.');
      this.observation = null; this.lastClick = null;
      result = await callbacks[name](); current();
    }
    current();
    return { ...(result || { result: 'Request delivered; inspect current state to verify.' }), mirrorState: a.onMirrorState() };
  }
}
