const createModel = (...args) => window.Vosk.createModel(...args);

// Small English Vosk model. It is downloaded once and reused by the browser.
const MODEL_URL = 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz';

const normalize = (value) => String(value || '')
  .toLocaleLowerCase()
  .replace(/[^a-z\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const containsWakePhrase = (value, phrase) => {
  const text = normalize(value);
  const target = normalize(phrase);
  if (!text || !target) return false;
  if (text.includes(target)) return true;
  const words = text.split(' ');
  return words.some((word, index) => {
    const next = words[index + 1] || '';
    return (word.startsWith('mir') || word === 'near' || word === 'mere')
      && (next.startsWith('mir') || next === 'near' || next === 'mere');
  });
};

export class WakeWordListener {
  constructor({ phrase = 'mirror mirror', onWake, onStatus }) {
    this.phrase = phrase;
    this.onWake = onWake || (() => {});
    this.onStatus = onStatus || (() => {});
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
  }

  async start() {
    this.enabled = true;
    if (this.processor) return;
    try {
      if (!this.model) await this._initialize();
      if (!this.enabled || this.processor) return;
      await this._startMicrophone();
      this.onStatus('armed');
    } catch (error) {
      console.warn('[wake word]', error.message);
      this.onStatus('unavailable');
    }
  }

  async _initialize() {
    if (this.initializing) return this.initializing;
    this.initializing = (async () => {
      this.onStatus('training');
      this.model = await createModel(MODEL_URL);
      this.model.setLogLevel?.(-1);
      this.recognizer = new this.model.KaldiRecognizer(16000);
      this.recognizer.on('partialresult', (message) => this._check(message?.result?.partial));
      this.recognizer.on('result', (message) => this._check(message?.result?.text));
    })();
    try { await this.initializing; }
    finally { this.initializing = null; }
  }

  async _startMicrophone() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1, sampleRate: 16000 }
    });
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    await this.audioContext.resume();
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
  }

  _check(text) {
    if (!this.enabled || !containsWakePhrase(text, this.phrase)) return;
    const now = Date.now();
    if (now - this.lastWakeAt < 2500) return;
    this.lastWakeAt = now;
    this.onStatus('heard');
    this.pause().then(() => this.onWake(''));
  }

  async pause() {
    this.enabled = false;
    this.processor?.disconnect();
    this.silentGain?.disconnect();
    this.source?.disconnect();
    this.processor = null;
    this.silentGain = null;
    this.source = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.audioContext) {
      await this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.onStatus('paused');
  }

  resume() { return this.start(); }

  async destroy() {
    await this.pause();
    this.recognizer?.remove?.();
    this.model?.terminate?.();
    this.recognizer = null;
    this.model = null;
  }
}
