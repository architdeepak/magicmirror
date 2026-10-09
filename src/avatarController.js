import { TalkingHead } from 'talkinghead';
import { AvatarPresence } from './avatarPresence.js';
import { FaceHost } from './faceHost.js';
import { RigFaceHost } from './rigFaceHost.js';
import { ExpressionMixer } from './expressionMixer.js';
import { AvatarVideoHost } from './avatarVideoHost.js';

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
    this.depthEnabled = false;
    this.lastLookAt = 0;
    this.persona = 'velora';
    this.facePuppetEnabled = false;
    this.faceBlendshapes = {};
    this.smoothedBlendshapes = {};
    this.eyeGaze = { x: 0, y: 0, confidence: 0 };
    this.gazeOverride = null;
    this.viseme = 'rest';
    this.performance = { turn: 0, nod: 0, lean: 0 };
    this.expression = {};
    this.expressionMixer = new ExpressionMixer();
    this.presence = new AvatarPresence();
    this.fallbackRigUrl = 'assets/avatar.glb';
    this.loadedRigUrl = null;
    this.lastRigError = null;
    this.quality='auto';
    this.faceHost = null;
    this.rigHost = null;
    this.renderStyle = 'portrait';this.styleGeneration=0;this.onSurfaceChange=()=>{};
    this.videoHost = null;
  }

  async init(url = 'assets/avatar.glb') {
    this.fallbackRigUrl = url;
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

      await this._showRig(url);
      // TalkingHead stays mounted solely as the proven low-latency PCM player.
      // The visible performer is our face-only host below; hide every generic
      // canvas before first paint so a body can never flash on the mirror.
      this.host.querySelectorAll('canvas').forEach((canvas) => { canvas.style.display = 'none'; });
      // This renderer is never presented: TalkingHead owns PCM/viseme timing,
      // while FaceHost owns the visible performer. Avoid drawing an invisible
      // full GLB on every audio animation tick. Keep its audio clock intact.
      this.head.renderer.render = () => {};
      const aura = document.createElement('div'); aura.className = 'host-aura'; aura.setAttribute('aria-hidden','true'); this.host.append(aura);
      this.faceHost = new FaceHost(this.host);this.faceHost.setQuality(this.quality);
      this.videoHost = new AvatarVideoHost(this.host);
      // Experimental rig previews are explicitly created by their preview
      // tool. Normal use needs neither its WebGL context nor its model loads.
      this.head.setView('head', { cameraDistance: 0.32, cameraY: -0.035 });
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

  async _showRig(url) {
    await this.head.showAvatar({
        url,
        body: 'F',
        avatarMood: 'neutral',
        lipsyncLang: 'en',
        lipsyncHeadMovement: true,
        avatarIdleEyeContact: 0.74,
        avatarSpeakingEyeContact: 0.9
    });
    this.loadedRigUrl = url;
  }

  async ensureRigHost() {
    if (!this.rigHost) {
      this.rigHost = new RigFaceHost(this.host,{onFailure:error=>{
        const failed=this.rigHost;this.rigHost=null;failed?.dispose();this.lastRigError=error.message;this.renderStyle='portrait';this._syncAvatarSourceVisibility();this.onStyleFallback?.(error.message);
      }});
      this.rigHost.setQuality(this.quality);
    }
    await this.rigHost.setPersona(this.persona);
    return this.rigHost;
  }

  async setRenderStyle(style) {
    const generation=++this.styleGeneration;
    this.renderStyle=style==='rig'?'rig':'portrait';
    if(this.renderStyle==='rig') {
      try { await this.ensureRigHost(); }
      catch(error) { if(generation!==this.styleGeneration)return false;this.lastRigError=error.message;this.renderStyle='portrait';this.onStyleFallback?.(error.message); }
    }
    if(generation!==this.styleGeneration)return false;
    this._syncAvatarSourceVisibility();return this.renderStyle===style;
  }

  getVisibleCanvas() { if(this.videoHost?.active)return null;return this.renderStyle==='rig'&&this.rigHost?.ready?this.rigHost.canvas:this.faceHost?.canvas; }

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

  setDepthEnabled(enabled) {
    this.depthEnabled = Boolean(enabled);
    this._syncAvatarSourceVisibility();
  }

  async setPersona(persona) {
    this.persona = ['velora', 'solenne', 'rowan'].includes(persona) ? persona : 'velora';
    this.host.dataset.persona = this.persona;
    // These values are safe with the shared starter rig. When dedicated GLBs
    // arrive, this same selector will simply load the corresponding rig.
    const moods = { velora: 'neutral', solenne: 'happy', rowan: 'neutral' };
    this.setMood(moods[this.persona]);
    this.faceHost?.setPersona(this.persona);
    if(this.renderStyle==='rig') await this.setRenderStyle('rig');
    else this._syncAvatarSourceVisibility();
  }

  setFacePuppetEnabled(enabled) {
    this.facePuppetEnabled = Boolean(enabled);
    if (!this.facePuppetEnabled) {
      this.faceBlendshapes = {};
      this.smoothedBlendshapes = {};
    }
  }

  setFaceBlendshapes(blendshapes = {}) {
    if (this.facePuppetEnabled) this.faceBlendshapes = blendshapes || {};
  }

  setEyeGaze(gaze = {}) {
    this.eyeGaze = gaze || { x: 0, y: 0, confidence: 0 };
  }

  setGazeOverride(gaze) { this.gazeOverride = gaze ? { x: clamp(Number(gaze.x) || 0,-1,1), y: clamp(Number(gaze.y) || 0,-1,1), confidence: 1 } : null; }

  setSpeechLevel(level) { this.speechLevel = Math.min(1, Math.max(0, level)); }

  setViseme(viseme) { this.viseme = viseme || 'rest'; }

  setPerformance(performance) { this.performance = performance || { turn: 0, nod: 0, lean: 0 }; }

  setQuality(id) { this.quality=id;this.faceHost?.setQuality(id);this.rigHost?.setQuality(id); }

  setActivity(activity) { this.presence.setActivity(activity); }

  setExpression(expression = {}) { this.expression = expression || {}; }

  // A generative avatar backend (for example an AVTR/WebRTC service) can hand
  // us a MediaStream or a URL. This switches render ownership atomically: no
  // raster mouth or GLB expression layer remains visible under generated video.
  async setAvatarVideoStream(stream) {
    await this.videoHost?.setStream(stream);
    this._syncAvatarSourceVisibility();
  }

  async setAvatarVideoUrl(url) {
    await this.videoHost?.setUrl(url);
    this._syncAvatarSourceVisibility();
  }

  clearAvatarVideo() {
    this.videoHost?.clear();
    this._syncAvatarSourceVisibility();
  }

  getAvatarVideoStatus() {
    return this.videoHost?.getStatus() || { active: false, source: 'none', state: 'unavailable' };
  }

  _syncAvatarSourceVisibility() {
    const streaming=Boolean(this.videoHost?.active),rig=this.renderStyle==='rig'&&this.rigHost?.ready;
    if(this.faceHost?.canvas){this.faceHost.canvas.style.display=streaming||rig?'none':'block';this.faceHost.canvas.style.opacity=this.depthEnabled?'.001':'1';}
    if(this.rigHost?.canvas){this.rigHost.canvas.style.display=!streaming&&rig?'block':'none';this.rigHost.canvas.style.opacity=this.depthEnabled?'.001':'1';}
    this.onSurfaceChange(this.getVisibleCanvas());
  }

  setMood(mood) {
    this.expressionMixer.setMood(mood);
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
    this.setSpeechLevel(0);
    this.setViseme('rest');
    this.setPerformance({ turn: 0, nod: 0, lean: 0 });
    this.setExpression({});
  }

  interrupt() {
    if (!this.streaming) return;
    try { this.head?.streamInterrupt(); } catch (error) { console.debug('[avatar] interrupt', error.message); }
    this.setSpeechLevel(0);
    this.setViseme('rest');
    this.setPerformance({ turn: 0, nod: 0, lean: 0 });
    this.setExpression({});
  }

  update(dt, elapsed, viewer) {
    if (!this.visible) return;
    const offsetX = viewer.x * (this.depthEnabled ? -15 : -7);
    // Never add a perpetual idle bounce to a face-only host. It makes a still
    // frame look like a sticker and fights deliberate nods from the performer.
    const offsetY = viewer.y * (this.depthEnabled ? 8 : 4);
    const rotateY = this.depthEnabled ? viewer.x * -.9 : 0;
    const rotateX = this.depthEnabled ? viewer.y * .45 : 0;
    // Layout owns the host's size and position, including its compact Try On
    // corner. Window-relative mode offsets can push it over the viewer's body
    // or outside a portrait display when the surrounding desktop is wider.
    this.host.style.transform = `perspective(1400px) translate3d(${offsetX}px, ${offsetY}px, ${this.depthEnabled ? 26 : 0}px) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;

    if (this.head && elapsed - this.lastLookAt > 0.1) {
      this.lastLookAt = elapsed;
      try {
        // Drive TalkingHead's dedicated head/eye controls directly. The prior
        // screen-target approach moved only a few pixels and was lost beneath
        // the avatar's idle animation.
        this.head.setValue('bodyRotateY', clamp(viewer.x * 0.58, -0.72, 0.72), 130);
        this.head.setValue('bodyRotateX', clamp(-viewer.y * 0.34, -0.28, 0.42), 130);
        const gazeX = this.facePuppetEnabled ? this.eyeGaze.x * this.eyeGaze.confidence * .16 : 0;
        const gazeY = this.facePuppetEnabled ? this.eyeGaze.y * this.eyeGaze.confidence * .11 : 0;
        this.head.setValue('eyesRotateY', clamp(viewer.x * .34 + gazeX, -.48, .48), 90);
        this.head.setValue('eyesRotateX', clamp(-viewer.y * .22 + gazeY, -.24, .28), 90);
      } catch (error) { /* avatar can still be settling during first frames */ }
    }
    const presence = this.presence.update(elapsed, { reduced: this.host.closest('#app-shell')?.dataset.reducedMotion === 'true', trackedEyes: this.facePuppetEnabled && this.faceBlendshapes.eyeBlinkLeft != null });
    const tracking = this.facePuppetEnabled ? { ...this.faceBlendshapes } : {};
    // An explicit close request may accent the camera. It cannot reopen or
    // erase a tracked blink; automatic blinks remain disabled for tracked eyes.
    for (const key of ['eyeBlinkLeft','eyeBlinkRight']) if (this.expression[key] > 0) tracking[key] = Math.max(tracking[key] || 0,this.expression[key]);
    const expression = this.expressionMixer.update({
      tracking,
      manual: { ...presence.expression, ...this.expression },
      speech: this.speechLevel,
      viseme: this.viseme,
      dt
    });
    this.smoothedBlendshapes = expression;
    this._applyFacialMorphs(expression);
    if (!this.videoHost?.active) {
      const gaze=this.gazeOverride || (this.eyeGaze.confidence > .15 ? this.eyeGaze : presence.gaze);
      const acting={turn:(this.performance.turn||0)+(this.gazeOverride?this.gazeOverride.x*.12:presence.performance.turn),nod:(this.performance.nod||0)+presence.performance.nod,lean:(this.performance.lean||0)+presence.performance.lean};
      if(this.renderStyle==='rig'&&this.rigHost?.ready){this.rigHost.update(expression,gaze,acting,dt,viewer);}else{
      this.faceHost?.setFace(expression, this.gazeOverride || (this.eyeGaze.confidence > .15 ? this.eyeGaze : presence.gaze), this.speechLevel, viewer);
      this.faceHost?.setViseme(this.viseme);
      this.faceHost?.setPerformance({ turn: (this.performance.turn || 0) + (this.gazeOverride ? this.gazeOverride.x * .12 : presence.performance.turn), nod: (this.performance.nod || 0) + presence.performance.nod, lean: (this.performance.lean || 0) + presence.performance.lean });
      this.faceHost?.update(elapsed);
      }
    }
    this.speechLevel *= 0.82;
  }

  _applyFacialMorphs(expression = {}) {
    const trackedJaw = expression.jawOpen || 0;
    const targets = {
      ...expression,
      mouthOpen: Math.max(expression.mouthOpen || 0, trackedJaw),
      viseme_aa: Math.max(expression.viseme_aa || 0, trackedJaw),
      viseme_O: Math.max(expression.viseme_O || 0, expression.mouthFunnel || 0),
      viseme_oh: Math.max(expression.viseme_oh || 0, expression.mouthFunnel || 0)
    };
    for (const mesh of this.morphMeshes) {
      for (const [name, value] of Object.entries(targets)) {
        const index = mesh.morphTargetDictionary[name];
        if (index !== undefined) mesh.morphTargetInfluences[index] = value;
      }
    }
  }
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
