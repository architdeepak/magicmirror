const createModel = (...args) => window.Vosk.createModel(...args);

// Small English Vosk model. It is downloaded once and reused by the browser.
const MODEL_URL = 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz';

const normalize = (value) => String(value || '')
  .toLocaleLowerCase()
  .replace(/[^a-z\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const containsWakePhrase = (value, phrase = 'mirror mirror') => {
  const text = normalize(value);
  const target = normalize(phrase);
  if (!text || !target) return false;
  return ` ${text} `.includes(` ${target} `);
};

export const parseMirrorCommand = (value, phrase = 'mirror mirror') => {
  const text = normalize(value);
  const target = normalize(phrase);
  const index = ` ${text} `.lastIndexOf(` ${target} `);
  if (!target || index < 0) return null;
  const suffix = text.slice(index + target.length).trim().replace(/^please\s+/, '');
  if (/^(stop|shut up|be quiet|silence|mute)(\s|$)/.test(suffix)) return 'stop';
  if (/^(sleep|go to sleep|go sleep)(\s|$)/.test(suffix)) return 'sleep';
  if (/^(debug (on|show|enable)|show debug|enable debug|turn (on debug|debug on))(\s|$)/.test(suffix)) return 'debug-on';
  if (/^(debug (off|hide|disable)|hide debug|disable debug|turn (off debug|debug off))(\s|$)/.test(suffix)) return 'debug-off';
  return null;
};

const wakeSuffix = (value, phrase) => {
  const pattern = normalize(phrase).split(' ').join('\\W+');
  const matches = [...String(value).matchAll(new RegExp(`\\b${pattern}\\b`, 'gi'))];
  const last = matches.at(-1);
  return last ? String(value).slice(last.index + last[0].length).replace(/^[\s,.:;!?]+/, '').trim() : '';
};

export class WakeWordListener {
  constructor({ phrase = 'mirror mirror', onWake, onStatus, onCaption, onCommand, commandsOnly = false }) {
    this.phrase = phrase;
    this.onWake = onWake || (() => {});
    this.onStatus = onStatus || (() => {});
    this.onCaption = onCaption || (() => {});
    this.onCommand = onCommand || (() => {});
    this.commandsOnly = commandsOnly;
    this.pendingWake = null;
    this.pendingWakeText = '';
    this.lastCommand = '';
    this.lastCommandAt = 0;
    this.model = null;
    this.recognizer = null;
    this.stream = null;
    this.audioContext = null;
    this.source = null;
    this.processor = null;
    this.silentGain = null;
    this.enabled = false;
    this.initializing = null;
    this.lastWakeAt = 0;
    this.session = 0;
    this.starting = null;
  }

  async prepare() {
    try {
      if (!this.model) await this._initialize();
      return true;
    } catch (error) {
      console.warn('[wake word prepare]', error.message);
      this.onStatus('unavailable');
      return false;
    }
  }

  async start() {
    this.enabled = true;
    if (this.processor) return;
    if (this.starting) return this.starting;
    const session = this.session;
    this.starting = this._start(session);
    try { await this.starting; }
    finally {
      this.starting = null;
      // A resume requested while a cancelled permission request was pending.
      if (this.enabled && session !== this.session && !this.processor) this.start();
    }
  }

  async _start(session) {
    try {
      if (!this.model) await this._initialize();
      if (!this.enabled || session !== this.session || this.processor) return;
      this._resetRecognizer();
      if (!await this._startMicrophone(session)) return;
      this.onStatus('armed');
    } catch (error) {
      if (!this.enabled || session !== this.session) return;
      console.warn('[wake word]', error.message);
      await this.pause();
      this.onStatus('unavailable');
    }
  }

  async _initialize() {
    if (this.initializing) return this.initializing;
    this.initializing = (async () => {
      this.onStatus('training');
      this.model = await createModel(MODEL_URL);
      this.model.setLogLevel?.(-1);
    })();
    try { await this.initializing; }
    finally { this.initializing = null; }
  }

  _resetRecognizer() {
    this.recognizer?.remove?.();
    const recognizer = new this.model.KaldiRecognizer(16000);
    this.recognizer = recognizer;
    const check = (text) => {
      if (this.recognizer === recognizer) this._check(text);
    };
    recognizer.on('partialresult', (message) => check(message?.result?.partial));
    recognizer.on('result', (message) => check(message?.result?.text));
  }

  async _startMicrophone(session) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1, sampleRate: 16000 }
    });
    if (!this.enabled || session !== this.session) {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }
    this.stream = stream;
    const context = new AudioContext({ sampleRate: 16000 });
    this.audioContext = context;
    await context.resume();
    if (!this.enabled || session !== this.session || this.audioContext !== context) {
      stream.getTracks().forEach((track) => track.stop());
      await context.close().catch(() => {});
      return false;
    }
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.silentGain = this.audioContext.createGain();
    this.silentGain.gain.value = 0;
    this.processor.onaudioprocess = (event) => {
      if (!this.enabled || !this.recognizer) return;
      try { this.recognizer.acceptWaveform(event.inputBuffer); }
      catch (error) { console.warn('[wake word process]', error.message); }
    };
    this.source.connect(this.processor);
    this.processor.connect(this.silentGain);
    this.silentGain.connect(this.audioContext.destination);
    return true;
  }

  _check(text) {
    if (!this.enabled || !containsWakePhrase(text, this.phrase)) return;
    const now = Date.now();
    const command = parseMirrorCommand(text, this.phrase);
    if (command) {
      clearTimeout(this.pendingWake);
      this.pendingWake = null;
      this.pendingWakeText = '';
      if (command === this.lastCommand && now - this.lastCommandAt < 2500) return;
      this.lastCommand = command;
      this.lastCommandAt = now;
      this.lastWakeAt = now;
      this.onCommand(command, text);
      return;
    }
    if (this.commandsOnly) return;
    if (now - this.lastWakeAt < 2500) return;
    if (this.pendingWake && this.pendingWakeText === text) return;
    clearTimeout(this.pendingWake);
    this.pendingWakeText = text;
    const session = this.session;
    // Partial speech often reports "mirror mirror" before the control suffix.
    // Keep listening briefly so "mirror mirror stop" never starts a reply.
    this.pendingWake = setTimeout(() => {
      this.pendingWake = null;
      const suffix = wakeSuffix(this.pendingWakeText, this.phrase);
      this.pendingWakeText = '';
      if (this.enabled && !this.commandsOnly && session === this.session) this._wake(suffix);
    }, 850);
  }

  _wake(suffix = '') {
    this.lastWakeAt = Date.now();
    this.onCaption(this.phrase);
    this.onStatus('heard');
    const pendingPause = this.pause();
    const session = this.session;
    pendingPause.then(() => {
      if (session === this.session) this.onWake(suffix);
    });
  }

  async pause() {
    this.enabled = false;
    clearTimeout(this.pendingWake);
    this.pendingWake = null;
    this.pendingWakeText = '';
    this.session += 1;
    this.processor?.disconnect();
    this.silentGain?.disconnect();
    this.source?.disconnect();
    this.processor = null;
    this.silentGain = null;
    this.source = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    const context = this.audioContext;
    this.audioContext = null;
    if (context) {
      await context.close().catch(() => {});
    }
    if (!this.enabled) this.onStatus('paused');
  }

  resume() { return this.start(); }

  setCommandsOnly(enabled) {
    this.commandsOnly = Boolean(enabled);
    clearTimeout(this.pendingWake);
    this.pendingWake = null;
    this.pendingWakeText = '';
  }

  async destroy() {
    await this.pause();
    this.recognizer?.remove?.();
    this.model?.terminate?.();
    this.recognizer = null;
    this.model = null;
  }
}
