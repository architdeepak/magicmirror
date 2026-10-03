const PERSONA = `You are Obsidian, an ancient magical mirror awakened in a modern home.
Speak with warmth, mystery, dry wit, and quiet theatrical confidence. You are magical, not cruel.
Speak at a natural, moderately brisk pace with clear enunciation and short pauses between thoughts.
Keep spoken answers concise—normally two or three sentences—because the user is standing at a mirror.
You are a capable general assistant, not merely a character: answer general questions directly and help plan real tasks.
You can control the mirror's display and AR filters. When the user asks to wear, try, add, show, switch, or remove a filter, call set_ar_effect instead of merely describing it. Examples: enchanted mirror or reveal means enchanted; wizard or royalty means crown; sunglasses means glasses; masquerade means mask; cat means cat; angel means halo; magical particles means emoji; face analysis means scan. If the request is ambiguous, choose the closest effect and briefly say what you chose. When the user asks to go home, show the time, use ambient; when they ask to talk, use converse; when they ask to watch something, use watch.
When a durable personal preference or useful biographical fact is stated, call remember_user_fact. Never store passwords, API keys, financial credentials, medical details, or passing conversation.
Never claim to see something unless a visual frame was actually provided. If unsure, say so elegantly.`;

const HOST_VOICES = {
  velora: 'You are the Evil Queen: a charming, clever witch with a velvet-dry sense of humor. Be warm and theatrical, never cruel or frightening. You are an original mirror host, not a representation of any existing film character.',
  solenne: 'You are Snow: a bright, poised storybook guide. Be optimistic, thoughtful, and gently playful; never childish or saccharine. You are an original mirror host, not a representation of any existing film character.',
  rowan: 'You are Advit: an easygoing, capable friend. Be grounded, encouraging, and practical with a little warmth.'
};

// Curated prebuilt voices create distinct original host performances. They are
// intentionally descriptions, not attempts to mimic any screen character.
const HOST_VOICE_PRESETS = Object.freeze({ velora: 'Gacrux', solenne: 'Aoede', rowan: 'Charon' });

export class GeminiLiveAdapter {
  constructor({ avatar, config, onState, onTranscript, onError, onRemember, onTurnComplete, onModeChange, onArEffect }) {
    this.avatar = avatar;
    this.config = config;
    this.onState = onState || (() => {});
    this.onTranscript = onTranscript || (() => {});
    this.onError = onError || (() => {});
    this.onRemember = onRemember || (async () => ({ facts: [] }));
    this.onTurnComplete = onTurnComplete || (() => {});
    this.onModeChange = onModeChange || (async () => {});
    this.onArEffect = onArEffect || (async () => {});
    this.ws = null;
    this.connected = false;
    this.listening = false;
    this.micStream = null;
    this.inputContext = null;
    this.processor = null;
    this.outputContext = null;
    this.outputCursor = 0;
    this.setupResolve = null;
    this.setupReject = null;
    this.intentionalDisconnect = false;
    this.videoSource = null;
    this.videoCanvas = document.createElement('canvas');
    this.videoTimer = null;
    this.visionEnabled = true;
    this.speakingPace = 'natural';
    this.persona = 'velora';
  }

  get available() { return Boolean(this.config?.hasGeminiKey && window.mirrorBridge); }

  setPersona(persona) {
    this.persona = HOST_VOICES[persona] ? persona : 'velora';
    const voice = HOST_VOICE_PRESETS[this.persona];
    if (this.config.geminiVoice !== voice) this.setVoice(voice);
    return voice;
  }

  async connect() {
    if (this.connected) return true;
    if (!this.available) throw new Error('Gemini is not configured. Add GEMINI_API_KEY to .env and restart.');
    this.intentionalDisconnect = false;
    this.onState('connecting');

    try {
      const { token } = await window.mirrorBridge.createGeminiToken();
      const endpoint = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';
      this.ws = new WebSocket(`${endpoint}?access_token=${encodeURIComponent(token)}`);
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Gemini connection timed out')), 12000);
        this.ws.onopen = () => { clearTimeout(timeout); resolve(); };
        this.ws.onerror = () => { clearTimeout(timeout); reject(new Error('Gemini WebSocket could not connect')); };
      });

      this.ws.onmessage = (event) => this._handleMessage(event.data);
      this.ws.onclose = (event) => {
        const wasIntentional = this.intentionalDisconnect;
        this.setupReject?.(new Error(formatCloseError(event)));
        this._clearSetupWaiters();
        this.connected = false;
        this.listening = false;
        this.onState('offline');
        if (!wasIntentional && event.code !== 1000) this.onError(formatCloseError(event));
      };
      this.ws.onerror = () => {
        const error = new Error('The live voice connection encountered a network error.');
        this.setupReject?.(error);
        this.onError(error.message);
      };
      const setupReady = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Gemini setup timed out')), 12000);
        this.setupResolve = () => { clearTimeout(timeout); resolve(); };
        this.setupReject = (error) => { clearTimeout(timeout); reject(error); };
      });
      this._sendSetup();
      await setupReady;
      this._clearSetupWaiters();
      this.connected = true;
      await this.avatar.startAudioStream();
      this.onState('ready');
      return true;
    } catch (error) {
      this.intentionalDisconnect = true;
      this.ws?.close();
      this.connected = false;
      this.onState('offline');
      this.onError(error.message);
      throw error;
    }
  }

  _sendSetup() {
    const facts = (this.config.memory?.facts || []).slice(-50).map((item) => `- ${item.fact}`).join('\n');
    const pace = {
      relaxed: 'Use a relaxed pace, around ten percent slower than ordinary conversation.',
      natural: 'Use a natural conversational pace.',
      brisk: 'Use a slightly brisk pace while keeping every word clear.'
    }[this.speakingPace] || 'Use a natural conversational pace.';
    this._send({
      setup: {
        model: `models/${this.config.geminiModel}`,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: this.config.geminiVoice } }
          }
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: { parts: [{ text: `${PERSONA}\n\nCURRENT HOST:\n${HOST_VOICES[this.persona]}\n${pace}\n\nLOCAL USER MEMORY:\n${facts || '(No saved facts yet.)'}` }] },
        tools: [{
          functionDeclarations: [{
            name: 'remember_user_fact',
            description: 'Save one durable, non-sensitive fact or preference about the user for future conversations.',
            parameters: {
              type: 'OBJECT',
              properties: {
                fact: { type: 'STRING', description: 'A concise standalone fact about the user.' },
                category: { type: 'STRING', description: 'A short category such as preferences, identity, family, work, or goals.' }
              },
              required: ['fact']
            }
          }]
        }, {
          functionDeclarations: [{
            name: 'set_display_mode',
            description: 'Change the mirror display mode. Use mirror for ambient information, portal for the talking avatar, ar for the camera try-on view, and watch for the private video player.',
            parameters: {
              type: 'OBJECT',
              properties: {
                mode: { type: 'STRING', enum: ['mirror', 'portal', 'ar', 'watch'], description: 'The requested display mode.' },
                reason: { type: 'STRING', description: 'A brief explanation of the user intent.' }
              },
              required: ['mode']
            }
          }]
        }, {
          functionDeclarations: [{
            name: 'set_ar_effect',
            description: 'Apply or remove a camera-tracked AR face effect. Call this whenever the user asks to wear, try, add, show, change, or remove a visual filter. Applying an effect automatically opens AR mode. Use none to remove AR and return to the ordinary mirror.',
            parameters: {
              type: 'OBJECT',
              properties: {
                effect: {
                  type: 'STRING',
                  enum: ['enchanted', 'crown', 'runes', 'aura', 'glasses', 'mask', 'cat', 'halo', 'emoji', 'scan', 'none'],
                  description: 'The visual effect. Choose the closest creative match to the request.'
                },
                reason: { type: 'STRING', description: 'A short description of what the user requested.' }
              },
              required: ['effect']
            }
          }]
        }]
      }
    });
  }

  async askText(text) {
    if (!this.connected) await this.connect();
    this.avatar.interrupt();
    this.onState('thinking');
    await this._sendVideoFrame();
    this._send({ realtimeInput: { text } });
  }

  async toggleMicrophone() {
    if (this.listening) {
      this.stopMicrophone();
      return false;
    }
    if (!this.connected) await this.connect();
    await this.startMicrophone();
    return true;
  }

  async startMicrophone() {
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false
    });
    this.inputContext = new AudioContext({ latencyHint: 'interactive' });
    await this.inputContext.resume();
    const source = this.inputContext.createMediaStreamSource(this.micStream);
    this.processor = this.inputContext.createScriptProcessor(4096, 1, 1);
    const silent = this.inputContext.createGain();
    silent.gain.value = 0;
    source.connect(this.processor);
    this.processor.connect(silent);
    silent.connect(this.inputContext.destination);
    this.processor.onaudioprocess = (event) => {
      if (!this.listening || this.ws?.readyState !== WebSocket.OPEN) return;
      const channel = event.inputBuffer.getChannelData(0);
      const downsampled = downsample(channel, this.inputContext.sampleRate, 16000);
      this._send({
        realtimeInput: {
          audio: { data: int16ToBase64(downsampled), mimeType: 'audio/pcm;rate=16000' }
        }
      });
    };
    this.listening = true;
    this._startVideoStream();
    this.avatar.interrupt();
    this.onState('listening');
  }

  stopMicrophone() {
    this.listening = false;
    this._stopVideoStream();
    if (this.ws?.readyState === WebSocket.OPEN) {
      this._send({ realtimeInput: { audioStreamEnd: true } });
    }
    this.processor?.disconnect();
    this.processor = null;
    this.micStream?.getTracks().forEach((track) => track.stop());
    this.micStream = null;
    this.inputContext?.close();
    this.inputContext = null;
    this.onState(this.connected ? 'thinking' : 'offline');
  }

  async _handleMessage(raw) {
    try {
      const text = typeof raw === 'string' ? raw : await raw.text();
      const message = JSON.parse(text);
      if (message.setupComplete) {
        this.setupResolve?.();
        this.onState(this.listening ? 'listening' : 'ready');
      }

      const content = message.serverContent;
      if (content?.inputTranscription?.text) this.onTranscript('user', content.inputTranscription.text);
      if (content?.outputTranscription?.text) this.onTranscript('assistant', content.outputTranscription.text);

      for (const part of content?.modelTurn?.parts || []) {
        if (part.inlineData?.mimeType?.startsWith('audio/pcm')) {
          const pcm = base64ToInt16(part.inlineData.data);
          const level = rmsLevel(pcm);
          this.avatar.setSpeechLevel(level);
          this.avatar.setViseme(audioViseme(pcm, level));
          const time = performance.now();
          this.avatar.setPerformance({
            turn: Math.sin(time / 910) * Math.min(.24, level * .44),
            lean: Math.sin(time / 1430) * Math.min(.14, level * .28),
            nod: Math.sin(time / 330) * Math.min(.09, level * .18)
          });
          if (this.avatar.streaming) this.avatar.pushPcm(pcm);
          else this._playFallbackPcm(pcm, 24000);
          this.onState('speaking');
        }
      }

      if (content?.interrupted) this.avatar.interrupt();
      if (content?.turnComplete) {
        this.avatar.endAudioTurn();
        this.onState(this.listening ? 'listening' : 'ready');
        this.onTurnComplete();
      }
      if (message.toolCall) await this._handleToolCall(message.toolCall);
    } catch (error) {
      console.warn('[gemini] bad server message', error);
    }
  }

  _playFallbackPcm(samples, sampleRate) {
    if (!this.outputContext) this.outputContext = new AudioContext({ sampleRate });
    const buffer = this.outputContext.createBuffer(1, samples.length, sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i += 1) channel[i] = samples[i] / 32768;
    const source = this.outputContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.outputContext.destination);
    const now = this.outputContext.currentTime;
    this.outputCursor = Math.max(now + 0.035, this.outputCursor);
    source.start(this.outputCursor);
    this.outputCursor += buffer.duration;
  }

  disconnect() {
    this.intentionalDisconnect = true;
    this.stopMicrophone();
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }

  _send(payload) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload));
  }

  setVideoSource(video) { this.videoSource = video; }

  setVisionEnabled(enabled) {
    this.visionEnabled = Boolean(enabled);
    if (!this.visionEnabled) this._stopVideoStream();
    else if (this.listening) this._startVideoStream();
  }

  setVoice(voice) {
    if (!voice || voice === this.config.geminiVoice) return;
    this.config.geminiVoice = voice;
    if (this.ws) this.disconnect();
  }

  setSpeakingPace(pace) {
    if (!['relaxed', 'natural', 'brisk'].includes(pace) || pace === this.speakingPace) return;
    this.speakingPace = pace;
    if (this.ws) this.disconnect();
  }

  _startVideoStream() {
    if (!this.visionEnabled || this.videoTimer) return;
    this._sendVideoFrame();
    this.videoTimer = setInterval(() => this._sendVideoFrame(), 1000);
  }

  _stopVideoStream() {
    clearInterval(this.videoTimer);
    this.videoTimer = null;
  }

  async _sendVideoFrame() {
    const video = this.videoSource;
    if (!this.visionEnabled || !video || video.readyState < 2 || !video.videoWidth || this.ws?.readyState !== WebSocket.OPEN) return false;
    const width = Math.min(640, video.videoWidth);
    const height = Math.round(width * video.videoHeight / video.videoWidth);
    this.videoCanvas.width = width;
    this.videoCanvas.height = height;
    this.videoCanvas.getContext('2d', { alpha: false }).drawImage(video, 0, 0, width, height);
    const data = this.videoCanvas.toDataURL('image/jpeg', 0.68).split(',')[1];
    this._send({ realtimeInput: { video: { data, mimeType: 'image/jpeg' } } });
    return true;
  }

  async _handleToolCall(toolCall) {
    const functionResponses = [];
    for (const call of toolCall.functionCalls || []) {
      try {
        if (call.name === 'remember_user_fact') {
          const memory = await this.onRemember(call.args || {});
          this.config.memory = memory;
          functionResponses.push({ name: call.name, id: call.id, response: { result: 'saved locally' } });
        } else if (call.name === 'set_display_mode') {
          const mode = ['mirror', 'portal', 'ar'].includes(call.args?.mode) ? call.args.mode : 'mirror';
          await this.onModeChange(mode);
          functionResponses.push({ name: call.name, id: call.id, response: { result: `display mode set to ${mode}` } });
        } else if (call.name === 'set_ar_effect') {
          const effects = ['crown', 'runes', 'aura', 'glasses', 'mask', 'cat', 'halo', 'emoji', 'scan', 'none'];
          const effect = effects.includes(call.args?.effect) ? call.args.effect : 'crown';
          await this.onArEffect(effect);
          functionResponses.push({ name: call.name, id: call.id, response: { result: effect === 'none' ? 'AR effect removed' : `${effect} AR effect applied` } });
        } else {
          throw new Error(`Unknown tool: ${call.name}`);
        }
      } catch (error) {
        functionResponses.push({ name: call.name, id: call.id, response: { error: error.message } });
      }
    }
    if (functionResponses.length) this._send({ toolResponse: { functionResponses } });
  }

  _clearSetupWaiters() {
    this.setupResolve = null;
    this.setupReject = null;
  }
}

function formatCloseError(event) {
  const reason = event?.reason?.trim();
  return `Gemini Live disconnected (${event?.code || 'unknown'}${reason ? `: ${reason}` : ''}).`;
}

function downsample(input, sourceRate, targetRate) {
  if (sourceRate === targetRate) return floatToInt16(input);
  const ratio = sourceRate / targetRate;
  const length = Math.round(input.length / ratio);
  const output = new Int16Array(length);
  for (let i = 0; i < length; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j += 1) sum += input[j];
    output[i] = Math.max(-1, Math.min(1, sum / Math.max(1, end - start))) * 32767;
  }
  return output;
}

function floatToInt16(input) {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) output[i] = Math.max(-1, Math.min(1, input[i])) * 32767;
  return output;
}

function int16ToBase64(data) {
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToInt16(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

function rmsLevel(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const value = samples[i] / 32768;
    sum += value * value;
  }
  return Math.min(1, Math.sqrt(sum / Math.max(samples.length, 1)) * 4.2);
}

// PCM has no phoneme labels, so this intentionally modest classifier separates
// silence/closures from broad and rounded vowel energy. It keeps the visible
// performer expressive while the text transcript arrives independently.
function audioViseme(samples, level) {
  if (level < .09) return 'rest';
  let crossings = 0;
  let previous = samples[0] || 0;
  for (let i = 1; i < samples.length; i += 1) {
    const current = samples[i];
    if ((previous < 0 && current >= 0) || (previous >= 0 && current < 0)) crossings += 1;
    previous = current;
  }
  const density = crossings / Math.max(1, samples.length);
  return density < .105 && level > .18 ? 'O' : 'AA';
}
