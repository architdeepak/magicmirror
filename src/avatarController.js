import { TalkingHead } from 'talkinghead';

export class AvatarController {
  constructor({ host, onStatus }) {
    this.host = host;
    this.onStatus = onStatus || (() => {});
    this.head = null;
    this.armature = null;
    this.morphMeshes = [];
    this.speechLevel = 0;
    this.streaming = false;
    this.visible = true;
    this.displayMode = 'portal';
    this.lastLookAt = 0;
  }

  async init(url = 'assets/avatar.glb') {
    this.onStatus('Loading 3D oracle…');
    try {
      this.head = new TalkingHead(this.host, {
        cameraView: 'head',
        cameraRotateEnable: false,
        cameraPanEnable: false,
        cameraZoomEnable: false,
        modelPixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
        modelFPS: 30,
        modelMovementFactor: 0.42,
        pcmSampleRate: 24000,
        lipsyncLang: 'en',
        lipsyncModules: ['en'],
        avatarIdleEyeContact: 0.74,
        avatarIdleHeadMove: 0.12,
        avatarSpeakingEyeContact: 0.9,
        avatarSpeakingHeadMove: 0.28,
        avatarMood: 'neutral',
        lightAmbientColor: 0x776c92,
        lightAmbientIntensity: 3.2,
        lightDirectColor: 0xffdfaa,
        lightDirectIntensity: 22,
        lightDirectPhi: 0.7,
        lightDirectTheta: 1.5,
        lightSpotColor: 0x8a45ff,
        lightSpotIntensity: 14,
        lightSpotPhi: 0.5,
        lightSpotTheta: 4.3,
        lightSpotDispersion: 1.1
      });

      await this.head.showAvatar({
        url,
        body: 'F',
        avatarMood: 'neutral',
        lipsyncLang: 'en',
        lipsyncHeadMovement: true,
        avatarIdleEyeContact: 0.74,
        avatarSpeakingEyeContact: 0.9
      });
      this.head.setView('head', { cameraDistance: 0.1, cameraY: 0.02 });
      this.armature = this.head.armature;
      this._collectMorphMeshes();
      this.onStatus('Oracle ready');
      return true;
    } catch (error) {
      console.warn('[avatar] TalkingHead could not load this GLB:', error);
      this.host.innerHTML = '<div class="fallback-presence"><i></i><b>✦</b></div>';
      this.onStatus('Magical fallback ready');
      return false;
    }
  }

  _collectMorphMeshes() {
    this.morphMeshes = [];
    this.armature?.traverse((child) => {
      if (child.isMesh && child.morphTargetDictionary && child.morphTargetInfluences) this.morphMeshes.push(child);
    });
  }

  setVisible(visible) {
    this.visible = visible;
    this.host.style.opacity = visible ? '1' : '0';
    this.host.style.visibility = visible ? 'visible' : 'hidden';
  }

  setDisplayMode(mode) {
    this.displayMode = mode;
    this.host.dataset.mode = mode;
  }

  setSpeechLevel(level) { this.speechLevel = Math.min(1, Math.max(0, level)); }

  setMood(mood) {
    try { this.head?.setMood(mood); } catch (error) { console.debug('[avatar] mood', error.message); }
  }

  async startAudioStream() {
    if (!this.head || this.streaming) return;
    try {
      // Gemini Live returns signed 16-bit little-endian PCM at 24 kHz. TalkingHead
      // otherwise inherits the device's usual 48 kHz context, which plays the
      // stream at double speed and raises the voice by an octave.
      await this.head.streamStart({
        sampleRate: 24000,
        gain: 0.9,
        lipsyncType: 'visemes',
        waitForAudioChunks: true
      });
      this.streaming = true;
    } catch (error) {
      console.warn('[avatar] audio stream unavailable', error);
    }
  }

  pushPcm(pcm) {
    if (!this.head || !this.streaming) return;
    try { this.head.streamAudio({ audio: pcm }); } catch (error) { console.debug('[avatar] pcm', error.message); }
  }

  endAudioTurn() {
    if (!this.streaming) return;
    try { this.head?.streamNotifyEnd(); } catch (error) { console.debug('[avatar] end stream', error.message); }
  }

  interrupt() {
    if (!this.streaming) return;
    try { this.head?.streamInterrupt(); } catch (error) { console.debug('[avatar] interrupt', error.message); }
  }

  update(dt, elapsed, viewer) {
    if (!this.visible) return;
    const offsetX = viewer.x * -7;
    const offsetY = viewer.y * 4 + Math.sin(elapsed * 1.2) * 1.5;
    const modeScale = this.displayMode === 'ar' ? 0.58 : 1;
    const modeX = this.displayMode === 'ar' ? window.innerWidth * 0.19 : 0;
    const modeY = this.displayMode === 'ar' ? window.innerHeight * 0.2 : 0;
    this.host.style.transform = `translate3d(${modeX + offsetX}px, ${modeY + offsetY}px, 0) scale(${modeScale})`;

    if (this.head && elapsed - this.lastLookAt > 0.1) {
      this.lastLookAt = elapsed;
      try {
        // Drive TalkingHead's dedicated head/eye controls directly. The prior
        // screen-target approach moved only a few pixels and was lost beneath
        // the avatar's idle animation.
        this.head.setValue('bodyRotateY', clamp(viewer.x * 0.58, -0.72, 0.72), 130);
        this.head.setValue('bodyRotateX', clamp(-viewer.y * 0.34, -0.28, 0.42), 130);
        this.head.setValue('eyesRotateY', clamp(viewer.x * 0.34, -0.48, 0.48), 90);
        this.head.setValue('eyesRotateX', clamp(-viewer.y * 0.22, -0.24, 0.28), 90);
      } catch (error) { /* avatar can still be settling during first frames */ }
    }
    this._applySpeechMorph(this.speechLevel);
    this.speechLevel *= 0.82;
  }

  _applySpeechMorph(level) {
    const jaw = Math.min(0.82, level * 1.35);
    const round = Math.min(0.42, level * 0.56);
    const targets = { jawOpen: jaw, mouthOpen: jaw, viseme_aa: jaw, viseme_O: round, viseme_oh: round };
    for (const mesh of this.morphMeshes) {
      for (const [name, value] of Object.entries(targets)) {
        const index = mesh.morphTargetDictionary[name];
        if (index !== undefined) mesh.morphTargetInfluences[index] = value;
      }
    }
  }
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
