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
    this._loadVoices();
    if (this.synth && 'onvoiceschanged' in this.synth) this.synth.onvoiceschanged = () => this._loadVoices();
  }

  _loadVoices() {
    this.voices = this.synth?.getVoices() || [];
    const preferred = [/Microsoft Ryan/i, /Microsoft Sonia/i, /Google UK English Female/i, /Zira/i, /David/i];
    this.voice = preferred.map((pattern) => this.voices.find((voice) => pattern.test(voice.name))).find(Boolean)
      || this.voices.find((voice) => voice.lang.startsWith('en-GB'))
      || this.voices.find((voice) => voice.lang.startsWith('en'))
      || this.voices[0];
  }

  respond(prompt) {
    const response = makeOfflineResponse(prompt);
    this.speak(response);
    return response;
  }

  speak(text) {
    if (!this.synth || !text) return;
    this.stop();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = this.voice || null;
    utterance.rate = 0.9;
    utterance.pitch = 0.72;
    utterance.volume = 1;
    utterance.onstart = () => {
      this.isSpeaking = true;
      this.avatar.setMood('neutral');
      this.callbacks.onState?.('speaking');
      this.timer = setInterval(() => {
        this.level = 0.2 + Math.random() * 0.62;
        this.avatar.setSpeechLevel(this.level);
      }, 86);
    };
    utterance.onend = () => this._finish();
    utterance.onerror = () => this._finish();
    this.synth.speak(utterance);
  }

  stop() {
    if (this.synth?.speaking) this.synth.cancel();
    this._finish();
  }

  _finish() {
    clearInterval(this.timer);
    this.timer = null;
    this.isSpeaking = false;
    this.level = 0;
    this.avatar.setSpeechLevel(0);
    this.callbacks.onState?.('ready');
  }
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
