import * as THREE from 'three';
import { GLTFLoader } from 'https://unpkg.com/three@0.165.0/examples/jsm/loaders/GLTFLoader.js';

/**
 * 3D Avatar & Ready Player Me Programmable Face Controller
 * Features:
 * - Ready Player Me 3D Avatar with 52 ARKit facial blendshapes
 * - Real-time Lip-Sync (jawOpen, mouthOpen, viseme_aa, viseme_O)
 * - 3D Eye Blinking (eyeBlinkLeft, eyeBlinkRight)
 * - Head tracking: 3D head bone turns to look at the viewer
 * - 2.5D Memoji Sprite Puppet mode for iPhone stickers
 */

const SHAPES = {
  closed: 'closed.png',
  small: 'small_open.png',
  wide: 'wide_open.png',
  round: 'round_oh.png',
  smile: 'smile_talk.png',
  blink: 'blink.png'
};

function amplitudeToShape(amp) {
  if (amp < 0.04) return 'closed';
  if (amp < 0.15) return 'small';
  if (amp < 0.30) return 'round';
  return 'wide';
}

export class PuppetFace {
  constructor(scene, assetPath = 'assets/mouths/', modelPath = 'assets/avatar.glb') {
    this.scene = scene;
    this.assetPath = assetPath;
    this.modelPath = modelPath;
    this.textures = {};
    this.currentShape = 'closed';
    this.loader = new THREE.TextureLoader();
    this.gltfLoader = new GLTFLoader();
    this.avatarMode = '3d'; // '3d' | 'memoji'

    // Root Group: Positioned at eye-level for a vertical 43" mirror
    this.group = new THREE.Group();
    this.group.position.set(0, 0.35, -1.2);
    scene.add(this.group);

    // 3D Avatar Properties
    this.avatar3D = null;
    this.morphMeshes = [];
    this.headBone = null;
    this.neckBone = null;

    // Lighting for 3D Avatar
    this._setupLighting();

    // Load 3D Ready Player Me Avatar
    this._load3DAvatar();

    // 2.5D Memoji Plane
    this._buildMemojiPlane();

    // Floating Embers
    this._buildAtmosphere();

    this._blinkTimer = 0;
    this._nextBlinkAt = 2.5 + Math.random() * 3.0;
    this.time = 0;

    this._loadAllMemojiTextures();
  }

  _setupLighting() {
    this.lightsGroup = new THREE.Group();

    const keyLight = new THREE.DirectionalLight(0xffeedd, 2.2);
    keyLight.position.set(1.5, 2.8, 2.5);
    this.lightsGroup.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xaa44ff, 3.2);
    rimLight.position.set(-2.2, 1.6, -1.2);
    this.lightsGroup.add(rimLight);

    const fireGlow = new THREE.PointLight(0xff5511, 3.0, 6);
    fireGlow.position.set(0, -1.8, 0.6);
    this.lightsGroup.add(fireGlow);

    const amb = new THREE.AmbientLight(0x181220, 1.5);
    this.lightsGroup.add(amb);

    this.group.add(this.lightsGroup);
  }

  _load3DAvatar() {
    this.gltfLoader.load(
      this.modelPath,
      (gltf) => {
        this.avatar3D = gltf.scene;
        console.log('[PuppetFace] 3D Avatar loaded successfully.');

        // Scale and frame the bust/head at standing eye level in 43" mirror
        this.avatar3D.scale.set(1.62, 1.62, 1.62);
        this.avatar3D.position.set(0, -2.05, 0);

        this.avatar3D.traverse((child) => {
          if (child.isMesh) {
            // Optimize materials for dark mirror reflection
            if (child.material) {
              child.material.roughness = Math.max(0.35, child.material.roughness || 0.5);
            }

            // Collect meshes with facial blendshapes (Head, Teeth, Eyes)
            if (child.morphTargetDictionary && child.morphTargetInfluences) {
              this.morphMeshes.push(child);
            }

            // Hide lower body meshes so only floating head & bust appear
            const hideNames = ['Wolf3D_Outfit_Bottom', 'Wolf3D_Outfit_Footwear', 'Wolf3D_Body'];
            if (hideNames.includes(child.name)) {
              child.visible = false;
            }
          }

          if (child.isBone) {
            if (child.name === 'Head') this.headBone = child;
            if (child.name === 'Neck') this.neckBone = child;
          }
        });

        this.group.add(this.avatar3D);
        this.setAvatarMode(this.avatarMode);
      },
      undefined,
      (err) => console.warn('[PuppetFace] Could not load 3D avatar GLB:', err)
    );
  }

  _buildMemojiPlane() {
    this.memojiGroup = new THREE.Group();
    const geo = new THREE.PlaneGeometry(2.2, 2.2);
    this.memojiMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 1,
      depthWrite: false
    });
    this.memojiMesh = new THREE.Mesh(geo, this.memojiMat);
    this.memojiGroup.add(this.memojiMesh);
    this.group.add(this.memojiGroup);
  }

  _buildAtmosphere() {
    const count = 35;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const scales = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 3.0;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 3.0;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.8 - 0.1;
      scales[i] = Math.random() * 0.05 + 0.02;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('scale', new THREE.BufferAttribute(scales, 1));

    const pMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute float scale;
        varying float vAlpha;
        uniform float uTime;
        void main() {
          vec3 p = position;
          p.y += sin(uTime + p.x * 2.0) * 0.15;
          p.x += cos(uTime * 0.7 + p.y * 1.5) * 0.1;
          vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = scale * (280.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
          vAlpha = 0.4 + 0.4 * sin(uTime * 2.5 + p.x * 8.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float intensity = smoothstep(0.5, 0.0, dist);
          vec3 col = mix(vec3(0.95, 0.4, 0.1), vec3(0.8, 0.2, 0.6), intensity);
          gl_FragColor = vec4(col, intensity * vAlpha * 0.75);
        }
      `,
      uniforms: { uTime: { value: 0 } }
    });

    this.particles = new THREE.Points(geo, pMat);
    this.group.add(this.particles);
  }

  _loadAllMemojiTextures() {
    for (const [key, file] of Object.entries(SHAPES)) {
      this.loader.load(
        this.assetPath + file,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          this.textures[key] = tex;
          if (key === 'closed' && this.memojiMesh) this.memojiMesh.material.map = tex;
          if (this.memojiMesh) this.memojiMesh.material.needsUpdate = true;
        },
        undefined,
        () => {}
      );
    }
  }

  setAvatarMode(mode) {
    this.avatarMode = mode;
    if (mode === '3d') {
      if (this.avatar3D) this.avatar3D.visible = true;
      this.memojiGroup.visible = false;
      this.lightsGroup.visible = true;
    } else {
      if (this.avatar3D) this.avatar3D.visible = false;
      this.memojiGroup.visible = true;
      this.lightsGroup.visible = false;
    }
  }

  /**
   * Set facial blendshape on all morph meshes
   */
  _setMorphTarget(name, value) {
    for (let i = 0; i < this.morphMeshes.length; i++) {
      const mesh = this.morphMeshes[i];
      const idx = mesh.morphTargetDictionary[name];
      if (idx !== undefined) {
        mesh.morphTargetInfluences[idx] = value;
      }
    }
  }

  update(dt, amplitude, headPosition = { x: 0, y: 0 }) {
    this.time += dt;

    // Subtle levitation bobbing
    this.group.position.y = 0.05 + Math.sin(this.time * 1.5) * 0.035;
    this.group.position.x = Math.sin(this.time * 0.8) * 0.015;

    // Embers
    this.particles.material.uniforms.uTime.value = this.time;

    // Blinking Timer
    this._blinkTimer += dt;
    let blinkValue = 0;
    if (this._blinkTimer > this._nextBlinkAt) {
      const progress = (this._blinkTimer - this._nextBlinkAt) / 0.16;
      if (progress < 1.0) {
        blinkValue = Math.sin(progress * Math.PI);
      } else {
        this._blinkTimer = 0;
        this._nextBlinkAt = 2.5 + Math.random() * 3.5;
      }
    }

    // 1. Update 3D Avatar (Blendshapes + Bones)
    if (this.avatarMode === '3d' && this.avatar3D) {
      // 3D Head Bone Tracking: Turns head towards viewer position
      if (this.headBone) {
        const targetRotY = headPosition.x * 0.35;
        const targetRotX = -headPosition.y * 0.22;
        this.headBone.rotation.y += (targetRotY - this.headBone.rotation.y) * 0.15;
        this.headBone.rotation.x += (targetRotX - this.headBone.rotation.x) * 0.15;
      }
      if (this.neckBone) {
        this.neckBone.rotation.y = headPosition.x * 0.15;
      }

      // Eye Blinking Blendshapes
      this._setMorphTarget('eyeBlinkLeft', blinkValue);
      this._setMorphTarget('eyeBlinkRight', blinkValue);

      // Speech Lip-Sync Blendshapes
      const jaw = Math.min(1.0, amplitude * 1.4);
      const mouthA = Math.min(1.0, amplitude * 1.1);
      const mouthO = Math.min(0.8, amplitude * 0.8);

      this._setMorphTarget('jawOpen', jaw);
      this._setMorphTarget('mouthOpen', mouthA);
      this._setMorphTarget('viseme_aa', mouthA);
      this._setMorphTarget('viseme_O', mouthO);
    }

    // 2. Update 2.5D Memoji Sprite Puppet
    if (this.avatarMode === 'memoji') {
      let shapeKey = blinkValue > 0.5 && this.textures.blink ? 'blink' : amplitudeToShape(amplitude);
      if (shapeKey !== this.currentShape && this.textures[shapeKey]) {
        this.currentShape = shapeKey;
        this.memojiMesh.material.map = this.textures[shapeKey];
        this.memojiMesh.material.needsUpdate = true;
      }

      this.group.rotation.y = headPosition.x * 0.28;
      this.group.rotation.x = -headPosition.y * 0.18;
    }
  }
}
