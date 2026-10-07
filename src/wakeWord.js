const createModel = (url) => {
  if (!window.Vosk.Model) return window.Vosk.createModel(url);
  const model = new window.Vosk.Model(url, -1);
  const loading = new Promise((resolve, reject) => {
    model.on('load', event => event.result ? resolve(model) : reject(new Error('The local speech model could not load.')));
    model.on('error', event => reject(new Error(event.error || 'The local speech model could not load.')));
  });
  loading.cancel = () => model.worker?.terminate();
  return loading;
};

// Small English Vosk model bundled with the app, cached by Vosk after extraction.
const MODEL_URL = 'http://127.0.0.1:39137/vosk-small-en-us-0.15.tar.gz';

const normalize = (value) => String(value || '')
  .toLocaleLowerCase()
  .replace(/[^a-z\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const containsWakePhrase = (value, phrase) => {
  const text = normalize(value);
  const target = normalize(phrase);
  if (!text || !target) return false;
  return (` ${text} `).includes(` ${target} `);
};

export class WakeWordListener {
  constructor({ phrase = 'mirror mirror', onWake, onStop, onStatus, onTranscript }) {
    this.phrase = phrase;
    this.onWake = onWake || (() => {});
    this.onStop = onStop || (() => {});
    this.onStatus = onStatus || (() => {});
    this.onTranscript = onTranscript;
    this.captionRecognizer = null;
    this.captionGeneration = 0;
    this.captionPrefix = [];
    this.model = null;
    this.recognizer = null;
    this.stream = null;
    this.streamEndCleanup = null;
    this.audioContext = null;
    this.source = null;
    this.processor = null;
    this.silentGain = null;
    this.enabled = false;
    this.initializing = null;
    this.lastWakeAt = 0;
    this.assistantActive = false;
    this.generation = 0;
    this.starting = null;
    this.destroyed = false;
  }

  start() {
    if (this.destroyed) return Promise.resolve();
    this.enabled = true;
    if (this.processor) return Promise.resolve();
    if (this.starting) return this.starting;
    const generation = this.generation;
    const pending = (async () => {
      try {
        if (!this.model) await this._initialize();
        else this._createRecognizer();
        if (!this.enabled || generation !== this.generation || this.processor) return;
        await this._startMicrophone(generation);
        if (this.enabled && generation === this.generation && this.processor) this.onStatus('armed');
      } catch (error) {
        if (generation !== this.generation || this.destroyed) return;
        console.warn('[wake word]', error?.message || 'The local speech model could not load.');
        await this.pause();
        if (!this.enabled && generation + 1 === this.generation) this.onStatus('unavailable');
      }
    })();
    this.starting = pending;
    pending.finally(() => { if (this.starting === pending) this.starting = null; });
    return pending;
  }

  async _initialize() {
    if (this.initializing) return this.initializing;
    this.initializing = (async () => {
      this.onStatus('training');
      const url = window.mirrorBridge?.wakeModelUrl ? await window.mirrorBridge.wakeModelUrl() : MODEL_URL;
      const loading = createModel(url);
      let timer;
      const expired = new Promise((_,reject)=>{timer=setTimeout(()=>{loading.cancel?.();reject(new Error('Local speech model loading timed out. Toggle Wake word to retry.'));},45000);});
      let model;
      try { model = await Promise.race([loading,expired]); }
      catch(error){loading.cancel?.();throw error;}
      finally{clearTimeout(timer);}

      if (this.destroyed) { model.terminate?.(); return; }
      this.model = model;
      this.model.setLogLevel?.(-1);
      try { this._createRecognizer(); }
      catch (error) { this.model.terminate?.(); this.model = null; throw error; }
    })();
    try { await this.initializing; }
    finally { this.initializing = null; }
  }

  _createRecognizer() {
    this.stopCaptionTurn();
    this.captionPrefix = [];
    this.recognizer?.remove?.();
    // Unconstrained standby distinguishes "near mirror" from the wake phrase.
    // Active sessions need a small stop vocabulary to avoid "maybe stop"
    // replacing the user's "mirror stop" in the general speech decoder.
    const grammar = this.assistantActive
      ? JSON.stringify(['mirror stop', 'mirror mute', 'mirror quiet', 'mirror cancel', '[unk]'])
      : undefined;
    const recognizer = new this.model.KaldiRecognizer(16000, grammar);
    this.recognizer = recognizer;
    const check = (text) => { if (this.recognizer === recognizer) this._check(text); };
    recognizer.on('partialresult', (message) => check(message?.result?.partial));
    recognizer.on('result', (message) => check(message?.result?.text));
  }

  async _startMicrophone(generation) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1, sampleRate: 16000 }
    });
    // A user can hard-mute while the browser permission prompt is open. Do not
    // leave a late-resolving getUserMedia call holding the microphone open.
    if (!this.enabled || generation !== this.generation) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.stream = stream;
    const tracks = stream.getTracks();
    if (stream.active === false || tracks.some(track => track.readyState === 'ended')) throw new Error('The wake microphone stream has ended.');
    const onEnded = () => {
      if (generation !== this.generation || this.stream !== stream) return;
      void this.pause();
      this.onStatus('disconnected');
    };
    tracks.forEach(track => track.addEventListener?.('ended', onEnded));
    this.streamEndCleanup = () => tracks.forEach(track => track.removeEventListener?.('ended', onEnded));
    const audioContext = new AudioContext({ sampleRate: 16000 });
    this.audioContext = audioContext;
    await audioContext.resume();
    // pause() may have run while AudioContext.resume() was pending.
    if (!this.enabled || generation !== this.generation || this.stream !== stream || this.audioContext !== audioContext) {
      stream.getTracks().forEach((track) => track.stop());
      await audioContext.close().catch(() => {});
      if (this.stream === stream) this.stream = null;
      if (this.audioContext === audioContext) this.audioContext = null;
      return;
    }
    this.source = audioContext.createMediaStreamSource(stream);
    this.processor = audioContext.createScriptProcessor(4096, 1, 1);
    this.silentGain = this.audioContext.createGain();
    this.silentGain.gain.value = 0;
    this.processor.onaudioprocess = (event) => {
      if (!this.enabled || generation !== this.generation || !this.recognizer) return;
      try {
        const samples = event.inputBuffer.getChannelData(0).slice();
        const sampleRate = event.inputBuffer.sampleRate || audioContext.sampleRate || 16000;
        this.captionPrefix.push({ samples, sampleRate });
        // Two 256 ms blocks preserve words preceding the live speech detector.
        if (this.captionPrefix.length > 2) this.captionPrefix.shift();
        this.recognizer.acceptWaveform(event.inputBuffer);
        if (this.enabled) this.captionRecognizer?.acceptWaveformFloat(samples, sampleRate);
      }
      catch (error) { console.warn('[wake word process]', error.message); }
    };
    this.source.connect(this.processor);
    this.processor.connect(this.silentGain);
    this.silentGain.connect(this.audioContext.destination);
  }

  stopCaptionTurn() {
    this.captionGeneration += 1;
    this.captionRecognizer?.remove?.();
    this.captionRecognizer = null;
  }

  startCaptionTurn() {
    this.stopCaptionTurn();
    if (!this.enabled || !this.assistantActive || !this.model || !this.onTranscript) return 0;
    const epoch = this.captionGeneration;
    try {
      const recognizer = new this.model.KaldiRecognizer(16000);
      this.captionRecognizer = recognizer;
      let completed = '';
      const publish = (text, final) => {
        if (!this.enabled || !this.assistantActive || this.captionRecognizer !== recognizer || epoch !== this.captionGeneration) return;
        const value = String(text || '').trim();
        if (!value) return;
        const transcript = `${completed} ${value}`.trim();
        if (final) completed = transcript;
        this.onTranscript(transcript, { epoch, final });
      };
      recognizer.on('partialresult', message => publish(message?.result?.partial, false));
      recognizer.on('result', message => publish(message?.result?.text, true));
      for (const frame of this.captionPrefix) recognizer.acceptWaveformFloat(frame.samples, frame.sampleRate);
      return epoch;
    } catch (error) {
      this.stopCaptionTurn();
      console.warn('[local captions]', error?.message || 'Using live service transcription.');
      return 0;
    }
  }

  _check(text) {
    if (!this.enabled) return;
    const normalized = normalize(text);
    if (this.assistantActive && /\bmirror (?:stop|mute|quiet|cancel)\b/.test(normalized)) {
      void this.pause();
      this.onStop(normalized);
      return;
    }
    if (this.assistantActive || !containsWakePhrase(text, this.phrase)) return;
    const now = Date.now();
    if (now - this.lastWakeAt < 2500) return;
    this.lastWakeAt = now;
    this.onStatus('heard');
    void this.pause();
    this.onWake('');
  }

  async pause() {
    this.enabled = false;
    this.stopCaptionTurn();
    this.captionPrefix = [];
    this.generation += 1;
    this.starting = null;
    const context = this.audioContext;
    this.audioContext = null;
    this.processor?.disconnect();
    this.silentGain?.disconnect();
    this.source?.disconnect();
    this.processor = null;
    this.silentGain = null;
    this.source = null;
    this.streamEndCleanup?.();
    this.streamEndCleanup = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.onStatus('paused');
    if (context) await context.close().catch(() => {});
  }

  resume() { return this.start(); }

  setAssistantActive(active) {
    const changed = this.assistantActive !== Boolean(active);
    this.assistantActive = Boolean(active);
    if (changed && this.model && !this.destroyed) this._createRecognizer();
  }

  async destroy() {
    this.destroyed = true;
    await this.pause();
    this.recognizer?.remove?.();
    this.model?.terminate?.();
    this.recognizer = null;
    this.model = null;
  }
}
