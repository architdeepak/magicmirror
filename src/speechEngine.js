export class SpeechEngine {
  constructor(avatar, callbacks = {}) {
    this.avatar = avatar;
    this.callbacks = callbacks;
    this.synth = window.speechSynthesis;
    this.voices = [];
    this.voice = null;
    this.isSpeaking = false;
    this.level = 0;
    this.timer = null;
    this.performanceStart = 0;
    this.charIndex = 0;
    this.persona = 'velora';
    this._loadVoices();
    if (this.synth && 'onvoiceschanged' in this.synth) this.synth.onvoiceschanged = () => this._loadVoices();
  }

  _loadVoices() {
    this.voices = this.synth?.getVoices() || [];
    const profile = VOICE_PROFILES[this.persona] || VOICE_PROFILES.velora;
    this.voice = profile.preferred.map((pattern) => this.voices.find((voice) => pattern.test(voice.name))).find(Boolean)
      || this.voices.find((voice) => voice.lang.startsWith('en-GB'))
      || this.voices.find((voice) => voice.lang.startsWith('en'))
      || this.voices[0];
  }

  setPersona(persona) {
    this.persona = VOICE_PROFILES[persona] ? persona : 'velora';
    this._loadVoices();
  }

  respond(prompt) {
    const response = makeOfflineResponse(prompt);
    this.speak(response);
    return response;
  }

  speak(text) {
    if (!this.synth || !text) return Promise.resolve();
    this.stop();
    const completion = new Promise((resolve) => { this.resolveSpeech = resolve; });
    const utterance = new SpeechSynthesisUtterance(text);
    this.utterance = utterance;
    utterance.voice = this.voice || null;
    const profile = VOICE_PROFILES[this.persona] || VOICE_PROFILES.velora;
    utterance.rate = profile.rate;
    utterance.pitch = profile.pitch;
    utterance.volume = 1;
    utterance.onstart = () => {
      if (this.utterance !== utterance) return;
      this.isSpeaking = true;
      this.avatar.setMood('neutral');
      this.callbacks.onState?.('speaking');
      this.performanceStart = performance.now();
      const plan = makeVisemePlan(text);
      const millisecondsPerBeat = Math.max(68, Math.min(118, (text.length * 68) / Math.max(1, plan.length)));
      utterance.onboundary = (event) => { if (Number.isFinite(event.charIndex)) this.charIndex = Math.min(plan.length - 1, event.charIndex); };
      this.timer = setInterval(() => {
        const elapsed = performance.now() - this.performanceStart;
        const estimated = Math.min(plan.length - 1, Math.floor(elapsed / millisecondsPerBeat));
        const beat = Math.max(this.charIndex || 0, estimated);
        const viseme = plan[beat] || 'rest';
        this.level = viseme === 'rest' ? .04 : viseme === 'O' ? .45 : .72;
        this.avatar.setSpeechLevel(this.level);
        this.avatar.setViseme(viseme);
        const gesture = performanceGesture(elapsed);
        this.avatar.setPerformance({
          turn: gesture.turn,
          lean: gesture.lean,
          nod: gesture.nod
        });
        const blink = blinkAt(elapsed);
        this.avatar.setExpression({
          browInnerUp: viseme === 'AA' ? .3 : .08,
          browOuterUpRight: viseme === 'O' ? .42 : .12,
          eyeBlinkLeft: blink,
          eyeBlinkRight: blink
        });
      }, 86);
    };
    utterance.onend = () => { if (this.utterance === utterance) this._finish(); };
    utterance.onerror = utterance.onend;
    this.synth.speak(utterance);
    return completion;
  }

  stop() {
    this._finish();
    this.synth?.cancel();
  }

  _finish() {
    this.utterance = null;
    this.resolveSpeech?.();
    this.resolveSpeech = null;
    clearInterval(this.timer);
    this.timer = null;
    this.isSpeaking = false;
    this.level = 0;
    this.avatar.setSpeechLevel(0);
    this.avatar.setViseme('rest');
    this.avatar.setPerformance({ turn: 0, nod: 0, lean: 0 });
    this.avatar.setExpression({});
    this.callbacks.onState?.('ready');
  }
}

function performanceGesture(milliseconds) {
  // Sparse, authored beats are more believable than perpetual sine-wave
  // motion. The values are intentionally tiny for a face-only portrait.
  const beat = (center, width, amount) => amount * Math.exp(-Math.pow((milliseconds - center) / width, 2));
  return {
    turn: beat(980, 480, .20) - beat(2050, 480, .12) + beat(3550, 520, .10),
    lean: -beat(1000, 650, .07) + beat(3100, 720, .055),
    nod: -beat(1760, 155, .20) + beat(1990, 170, .075)
  };
}

function blinkAt(milliseconds) {
  const centers = [1180, 3280, 5360];
  return Math.max(0, ...centers.map((center) => Math.exp(-Math.pow((milliseconds - center) / 56, 2))));
}

// These are original performance directions, not voice clones or imitations.
// Browser voices vary by operating system, so the named regexes are merely
// preferences; every platform still has a graceful English-language fallback.
const VOICE_PROFILES = Object.freeze({
  velora: { rate: .84, pitch: .68, preferred: [/Microsoft Sonia/i, /Zira/i, /Google UK English Female/i, /Samantha/i] },
  solenne: { rate: 1.03, pitch: 1.16, preferred: [/Microsoft Jenny/i, /Samantha/i, /Google US English/i, /Microsoft Aria/i] },
  rowan: { rate: .96, pitch: .92, preferred: [/Microsoft Ryan/i, /Microsoft Guy/i, /Daniel/i, /Google UK English Male/i] }
});

// A lightweight, deterministic text timing plan for local speech synthesis.
// It is not phonetic recognition, but it gives vowels/consonant closures an
// intentional sequence instead of a random amplitude-driven open mouth.
function makeVisemePlan(text) {
  const phonemes = [];
  for (const char of String(text).toLowerCase()) {
    if ('ou'.includes(char)) phonemes.push('O');
    else if ('aeiy'.includes(char)) phonemes.push('AA');
    else if ('bmpfv'.includes(char)) phonemes.push('rest');
    else if (/\s|[,.!?;:]/.test(char)) phonemes.push('rest');
    else phonemes.push('AA');
  }
  return phonemes.length ? phonemes : ['rest'];
}

function makeOfflineResponse(prompt) {
  const value = String(prompt || '').trim();
  const lower = value.toLowerCase();
  if (/fairest|beautiful|pretty/.test(lower)) {
    return 'The glass sees more than beauty. Tonight, it sees a presence impossible to ignore.';
  }
  if (/time|date|day/.test(lower)) {
    return `The hour is ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Spend it with intention.`;
  }
  if (/who are you|your name/.test(lower)) {
    return 'I am the voice between reflection and shadow—the memory awake inside this glass.';
  }
  if (/weather|rain|temperature/.test(lower)) {
    return 'The skies are written in the upper corner of the mirror. For a spoken forecast, awaken my Gemini connection.';
  }
  if (/hello|hi|hey/.test(lower)) {
    return 'At last, you stand before me. Ask carefully—the mirror has a habit of telling the truth.';
  }
  const responses = [
    'The answer is forming in the dark between one reflection and the next.',
    'A curious question. The glass remembers every face, but reveals only what the moment requires.',
    'I have searched the quiet corridors behind the mirror. The path ahead favors courage over certainty.',
    'Your reflection already knows the answer. I merely give it a voice.'
  ];
  let hash = 0;
  for (const char of value) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return responses[Math.abs(hash) % responses.length];
}
