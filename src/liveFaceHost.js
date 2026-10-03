import * as THREE from 'three';

const PERSONAS = Object.freeze({
  velora: { skin: 0xe3a18b, hair: 0x17101a, iris: 0xb66a19, lip: 0x741631, crown: true },
  solenne: { skin: 0xf2c4ad, hair: 0x211b20, iris: 0x6d402b, lip: 0xd46d70, bow: true },
  rowan: { skin: 0xa96b4c, hair: 0x151313, iris: 0x552e1d, lip: 0x9a554d, shortHair: true }
});

// A deliberately head-only character puppet. Every expressive feature is a
// separate mesh, so motion is real-time—not a video or a static portrait.
export class LiveFaceHost {
  constructor(host) {
    this.host = host;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(27, 1, .05, 20);
    // Portrait hosts are narrow: frame the complete head by width, not height.
    this.camera.position.set(0, 0, 7.05);
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.domElement.className = 'live-face-host-canvas';
    host.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xf1d7ef, 0x17101f, 2.3));
    const key = new THREE.DirectionalLight(0xffe4c1, 4.4); key.position.set(2.6, 3.1, 4); this.scene.add(key);
    const rim = new THREE.PointLight(0x9265ff, 9, 6); rim.position.set(-2.4, 1.2, 1.5); this.scene.add(rim);
    this.expression = {}; this.gaze = {}; this.speech = 0; this.viewer = {};
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(host);
    this.setPersona('velora');
  }

  setPersona(persona) {
    this.persona = PERSONAS[persona] ? persona : 'velora';
    if (this.root) this.scene.remove(this.root);
    const spec = PERSONAS[this.persona];
    this.root = new THREE.Group(); this.root.rotation.y = 0;
    this.scene.add(this.root);
    const mat = (color, roughness = .52, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const skin = mat(spec.skin, .62); const hair = mat(spec.hair, .3); const white = mat(0xfffcfa, .38);
    this.head = mesh(new THREE.SphereGeometry(1, 48, 36), skin, [0, 0, 0], [.75, .92, .68]); this.root.add(this.head);
    // Back hair deliberately sits behind the face and creates a silhouette only.
    const backHair = mesh(new THREE.SphereGeometry(1, 40, 28), hair, [0, .12, -.13], [.83, .94, .54]); this.root.add(backHair);
    this.head.renderOrder = 2;
    this.ears = [-1, 1].map((side) => { const ear = mesh(new THREE.SphereGeometry(1, 24, 18), skin, [side * .76, -.02, -.02], [.14, .22, .11]); this.root.add(ear); return ear; });
    this.eyes = []; this.irises = []; this.lids = []; this.brows = [];
    [-1, 1].forEach((side) => {
      const eye = mesh(new THREE.SphereGeometry(1, 32, 24), white, [side * .285, .10, .60], [.205, .16, .075]);
      // Avoid a dead flat white: the iris, pupil, and catchlight all move together.
      eye.scale.y = .16; this.root.add(eye); this.eyes.push(eye);
      const iris = mesh(new THREE.SphereGeometry(1, 28, 20), mat(spec.iris, .24), [side * .285, .10, .682], [.094, .094, .022]); this.root.add(iris); this.irises.push(iris);
      const pupil = mesh(new THREE.SphereGeometry(1, 24, 18), mat(0x080609, .3), [side * .285, .10, .704], [.042, .052, .014]); this.root.add(pupil); this.irises.push(pupil);
      const glint = mesh(new THREE.SphereGeometry(1, 16, 12), mat(0xffffff, .16), [side * .265, .135, .721], [.018, .018, .008]); this.root.add(glint);
      const lid = mesh(new THREE.SphereGeometry(1, 28, 18), skin, [side * .285, .17, .69], [.215, .008, .03]); this.root.add(lid); this.lids.push(lid);
      const brow = mesh(new THREE.CapsuleGeometry(.032, .25, 5, 14), hair, [side * .285, .395, .66], [1, 1, 1]); brow.rotation.z = side * -.17; this.root.add(brow); this.brows.push(brow);
    });
    this.nose = mesh(new THREE.SphereGeometry(1, 28, 20), skin, [0, -.09, .70], [.10, .14, .11]); this.root.add(this.nose);
    this.mouth = mesh(new THREE.SphereGeometry(1, 32, 20), mat(0x280710, .35), [0, -.39, .70], [.18, .018, .025]); this.root.add(this.mouth);
    this.upperLip = mesh(new THREE.SphereGeometry(1, 28, 16), mat(spec.lip, .34), [0, -.372, .718], [.20, .043, .024]); this.root.add(this.upperLip);
    this.lowerLip = mesh(new THREE.SphereGeometry(1, 28, 16), mat(spec.lip, .34), [0, -.414, .718], [.19, .037, .024]); this.root.add(this.lowerLip);
    this.addHair(spec, hair, mat);
    this.resize();
  }

  addHair(spec, hair, mat) {
    if (spec.crown) {
      [-.25, 0, .25].forEach((x, index) => { const crown = mesh(new THREE.ConeGeometry(index === 1 ? .14 : .105, index === 1 ? .37 : .25, 4), mat(0xd9a745, .22, .75), [x, .98 + (index === 1 ? .06 : 0), .2], [1, 1, 1]); crown.rotation.y = Math.PI / 4; this.root.add(crown); });
    }
    if (spec.bow) {
      [-1, 1].forEach((side) => { const loop = mesh(new THREE.SphereGeometry(1, 24, 16), mat(0x2b74e8, .3), [side * .59, .62, .34], [.15, .11, .045]); this.root.add(loop); });
    }
    const count = spec.shortHair ? 6 : 5;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / Math.max(1, count - 1) - .5) * 1.15;
      const lock = mesh(new THREE.SphereGeometry(1, 28, 18), hair, [Math.sin(angle) * .48, .58 - Math.abs(angle) * .08, .59], [spec.shortHair ? .21 : .18, .34, .08]);
      lock.rotation.z = -angle * .62; this.root.add(lock);
    }
  }

  setFace(blendshapes, gaze, speech, viewer) { this.expression = blendshapes || {}; this.gaze = gaze || {}; this.speech = speech || 0; this.viewer = viewer || {}; }

  resize() { const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h, false); }

  update(elapsed) {
    const gazeX = clamp((this.gaze.x || 0) * (this.gaze.confidence || 0), -.65, .65);
    const gazeY = clamp((this.gaze.y || 0) * (this.gaze.confidence || 0), -.55, .55);
    this.root.rotation.y += ((this.viewer.x || 0) * -.24 - this.root.rotation.y) * .08;
    this.root.rotation.x += ((this.viewer.y || 0) * .10 - this.root.rotation.x) * .08;
    this.root.position.y = Math.sin(elapsed * 1.05) * .018;
    for (let i = 0; i < this.irises.length; i += 2) {
      this.irises[i].position.x = (i === 0 ? -.285 : .285) + gazeX * .035;
      this.irises[i + 1].position.x = (i === 0 ? -.285 : .285) + gazeX * .035;
      this.irises[i].position.y = .10 - gazeY * .028; this.irises[i + 1].position.y = .10 - gazeY * .028;
    }
    const autonomousBlink = Math.pow(Math.max(0, Math.sin(elapsed * .68 + .9)), 46);
    const blink = Math.max(this.expression.eyeBlinkLeft || 0, this.expression.eyeBlinkRight || 0, autonomousBlink);
    this.lids.forEach((lid) => { lid.scale.y = .008 + blink * .17; });
    const browLift = Math.max(this.expression.browInnerUp || 0, this.expression.browOuterUpLeft || 0, this.expression.browOuterUpRight || 0);
    this.brows.forEach((brow) => { brow.position.y = .395 + browLift * .08; });
    const jaw = clamp(Math.max(this.speech, this.expression.jawOpen || 0), 0, 1);
    const round = Math.max(this.expression.mouthFunnel || 0, this.expression.mouthPucker || 0);
    this.mouth.scale.set(round > .25 ? .105 : .18, .018 + jaw * .13, .025);
    this.lowerLip.position.y = -.414 - jaw * .055;
    this.lowerLip.scale.set(.19, .037 * (1 + jaw * .33), .024);
    const smile = Math.max(this.expression.mouthSmileLeft || 0, this.expression.mouthSmileRight || 0);
    this.upperLip.scale.x = .20 * (1 + smile * .16);
    this.renderer.render(this.scene, this.camera);
  }
}

function mesh(geometry, material, position, scale) { const value = new THREE.Mesh(geometry, material); value.position.set(...position); value.scale.set(...scale); return value; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
