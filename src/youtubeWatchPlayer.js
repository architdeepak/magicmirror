// The official IFrame API runs in a separate local frame. This class accepts
// only typed player state and command acknowledgements from that exact frame.
export class YouTubeWatchPlayer {
  constructor(frame, onNotice = () => {}) {
    this.frame = frame;
    this.onNotice = onNotice;
    this.token = '';
    this.active = false;
    this.state = { ready: false, state: -1, position: 0, duration: 0, error: '' };
    this.pending = new Map();
    this.pauseRequested = false;
    this.pausePending = false;
    this.duckRequested=false;this.duckSentToken='';this.duckSentActive=false;
    this.listener = (event) => this.receive(event);
    window.addEventListener('message', this.listener);
  }
  async load(videoId) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error('Use a valid YouTube video link.');
    this.detach();
    this.frame.removeAttribute('src'); this.frame.classList.remove('loaded');
    this.token = crypto.randomUUID(); this.active = true;
    const token = this.token;
    const endpoint = await window.mirrorBridge?.youtubePlayerUrl?.();
    if (this.token !== token || !this.active) return;
    if (!endpoint) { this.detach(); throw new Error('Open YouTube in the desktop browser for this preview.'); }
    const url = new URL(endpoint);
    if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:') throw new Error('Invalid local player address.');
    this.origin = url.origin;
    url.searchParams.set('video', videoId); url.searchParams.set('token', this.token);
    this.frame.src = url.href;
    this.frame.classList.add('loaded');
  }
  receive(event) {
    const message = event.data;
    if (!this.active || event.source !== this.frame.contentWindow || event.origin !== this.origin
      || message?.channel !== 'mirror-youtube' || message.token !== this.token) return;
    if (!['state', 'result'].includes(message.type)) return;
    if (message.state) {
      const value = message.state;
      if (![-1, 0, 1, 2, 3, 5].includes(value.state) || !Number.isFinite(value.position) || !Number.isFinite(value.duration)) return;
      const previousError = this.state.error;
      this.state = { ready: value.ready === true, state: value.state,
        position: Math.max(0, value.position), duration: Math.max(0, value.duration), error: String(value.error || '').slice(0, 240) };
      const d=value.audioDucking;
      if(d?.supported===true&&(d.volume===null||Number.isInteger(d.volume)&&d.volume>=0&&d.volume<=100))this.state.audioDucking={supported:true,requested:d.requested===true,active:d.active===true,pending:d.pending===true,userOverride:d.userOverride===true,volume:d.volume,muted:d.muted===true};
      this.syncDucking();
      if (this.state.error && this.state.error !== previousError) this.onNotice(this.state.error);
      if (this.pauseRequested && this.state.ready && [1, 3].includes(this.state.state) && !this.pausePending) {
        this.pausePending = true;
        void this.command('pause').catch(() => {}).finally(() => { this.pausePending = false; });
      }
    }
    if (message.type === 'result') {
      const request = this.pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timeout); this.pending.delete(message.id);
      if (message.error) request.reject(new Error(String(message.error).slice(0, 240)));
      else request.resolve({ result: 'Playback command sent', ...this.snapshot() });
    }
  }
  snapshot() { return { source: 'youtube', ...this.state,volumePercent:this.state.audioDucking?.volume??null,muted:this.state.audioDucking?.muted===true, playing: this.state.state === 1 }; }
  command(action, seconds) {
    if (!this.active || !this.state.ready) return Promise.reject(new Error('Wait for YouTube to finish connecting.'));
    if (!['play', 'pause', 'seek','volume'].includes(action)) return Promise.reject(new Error('Unsupported YouTube control.'));
    if(action==='volume'&&(!Number.isInteger(seconds)||seconds<0||seconds>100))return Promise.reject(new Error('Set video volume from 0 to 100.'));
    if (action === 'play') this.pauseRequested = false;
    if (action === 'pause') this.pauseRequested = true;
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error('YouTube did not respond. Use its player controls.')); }, 3000);
      this.pending.set(id, { resolve, reject, timeout });
      this.frame.contentWindow.postMessage({ channel: 'mirror-youtube', token: this.token, type: 'command', id, action, seconds,...(action==='volume'?{volume:seconds}:{}) }, this.origin);
    });
  }
  pause() {
    this.pauseRequested = true;
    if (this.active && this.state.ready) void this.command('pause').catch(() => {});
  }
  setDucking(active){this.duckRequested=Boolean(active);this.syncDucking();}
  syncDucking(){
    if(!this.active||!this.state.ready||!this.state.audioDucking?.supported)return;
    if(this.duckSentToken===this.token&&this.duckSentActive===this.duckRequested)return;
    if(!this.duckRequested&&this.duckSentToken!==this.token)return;
    this.duckSentToken=this.token;this.duckSentActive=this.duckRequested;
    this.frame.contentWindow.postMessage({channel:'mirror-youtube',token:this.token,type:'duck',active:this.duckRequested},this.origin);
  }
  detach() {
    for (const request of this.pending.values()) { clearTimeout(request.timeout); request.reject(new Error('YouTube source changed.')); }
    this.pending.clear(); this.active = false; this.token = '';
    this.duckSentToken='';this.duckSentActive=false;
    this.pauseRequested = false; this.pausePending = false;
    this.state = { ready: false, state: -1, position: 0, duration: 0, error: '' };
  }
  destroy() { this.detach(); window.removeEventListener('message', this.listener); }
}
