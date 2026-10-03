import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const RIGS = Object.freeze({ velora: 'assets/personas/velora-3d-v1.glb', solenne: 'assets/personas/solenne-3d-v1.glb', rowan: 'assets/personas/advit.glb' });
const FACE_PLATES = Object.freeze({
  velora: 'assets/personas/velora-hair-plate-v1.png',
  solenne: 'assets/personas/solenne-hair-plate-v1.png'
});

// Actual GLB face renderer: head pose uses a bone, expressions use local ARKit
// morph targets. It is the replacement path for all flat-image turn tricks.
export class RigFaceHost {
  constructor(host) {
    this.host = host; this.canvas = document.createElement('canvas'); this.canvas.className = 'rig-face-canvas'; host.appendChild(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.localClippingEnabled = true;
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(28, 1, .0001, 20);
    this.scene.add(new THREE.HemisphereLight(0xf3ecff, 0x15101f, 2.6));
    const key = new THREE.DirectionalLight(0xfff1d3, 3.4); key.position.set(1.3, 1.7, 2.8); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8d66d8, 2.1); rim.position.set(-2, 1, 1.5); this.scene.add(rim);
    this.loader = new GLTFLoader(); this.root = null; this.head = null; this.poseRoot = null; this.morphs = []; this.baseRotation = null; this.ready = false; this.loading = null; this.neckCrop = null;
    new ResizeObserver(() => this.resize()).observe(host);
  }
  resize() { const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight); this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  async setPersona(persona) {
    this.ready = false; const token = this.loading = this.loader.loadAsync(RIGS[persona] || RIGS.velora); const gltf = await token; if (this.loading !== token) return false;
    if (this.root) this.scene.remove(this.root); this.root = gltf.scene; this.scene.add(this.root); this.root.updateMatrixWorld(true);
    this.head = this.root.getObjectByName('Head') || this.root.getObjectByName('head') || this.root.getObjectByName('faceMesh') || this.root.getObjectByName('Bip01 Head') || this.root.getObjectByProperty('isSkinnedMesh', true) || this.root.getObjectByProperty('isMesh', true); this.morphs = [];
    const isFaceOnly = this.head?.name === 'faceMesh';
    this.poseRoot = isFaceOnly ? this.root : this.head;
    const leftEye = this.root.getObjectByName('LeftEye') || this.root.getObjectByName('Bip01 LEye'); const rightEye = this.root.getObjectByName('RightEye') || this.root.getObjectByName('Bip01 REye');
    const leftEyeAt = leftEye?.getWorldPosition(new THREE.Vector3()); const rightEyeAt = rightEye?.getWorldPosition(new THREE.Vector3());
    const eyeSpan = leftEyeAt && rightEyeAt ? leftEyeAt.distanceTo(rightEyeAt) : 0;
    const eyeCenter = leftEyeAt && rightEyeAt ? leftEyeAt.clone().add(rightEyeAt).multiplyScalar(.5) : null;
    // Crop the body at the neck in world space. This matters even in a staging
    // renderer: the mirror never presents a torso as an "emoji" character.
    this.neckCrop = !isFaceOnly && eyeCenter && eyeSpan ? new THREE.Plane(new THREE.Vector3(0, 1, 0), -(eyeCenter.y - eyeSpan * 2.5)) : null;
    this.root.traverse((node) => {
      if (!node.isMesh) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) if (material) { material.side = THREE.DoubleSide; material.depthWrite = true; material.clippingPlanes = this.neckCrop ? [this.neckCrop] : null; material.needsUpdate = true; }
      if (node.morphTargetDictionary) this.morphs.push(node);
    });
    if (!this.head || !this.morphs.length) throw new Error('Rig lacks a visible head or facial morphs');
    this.baseRotation = this.poseRoot.rotation.clone(); this.resize();
    if (isFaceOnly) {
      // The custom exporter produces a compact face mesh (and a matching blank
      // skull cap), so remove that generic underlay. An original transparent
      // hair/crown plate provides the silhouette while the ARKit mesh carries
      // eyes, lips, and expression in front of it.
      this.root.traverse((node) => { if (node.isMesh && node !== this.head) node.visible = false; });
      const box = new THREE.Box3().setFromObject(this.head); const size = box.getSize(new THREE.Vector3());
      const target = box.getCenter(new THREE.Vector3());
      const plateUrl = FACE_PLATES[persona];
      if (plateUrl) {
        const texture = await new THREE.TextureLoader().loadAsync(plateUrl);
        texture.colorSpace = THREE.SRGBColorSpace;
        // Explicit discard avoids a Chromium/transparent-canvas compositor bug
        // where zero-alpha pixels from a generated PNG could still darken the
        // rectangular plane behind the head.
        const plateMaterial = new THREE.ShaderMaterial({
          uniforms: { map: { value: texture } }, transparent: true, depthWrite: false,
          vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
          fragmentShader: 'uniform sampler2D map; varying vec2 vUv; void main(){ vec4 c=texture2D(map,vUv); if(c.a<0.02) discard; gl_FragColor=c; }'
        });
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 1.88, size.x * 1.88), plateMaterial);
        plate.position.copy(target).add(new THREE.Vector3(0, 0, -.035)); plate.renderOrder = -1;
        this.root.add(plate);
      }
      const horizontalFov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect);
      const distance = Math.max(.8, size.x / (2 * Math.tan(horizontalFov / 2) * .8));
      this.camera.position.copy(target).add(new THREE.Vector3(0, 0, distance)); this.camera.lookAt(target); this.ready = true; return true;
    }
    const target = eyeCenter ? eyeCenter.add(new THREE.Vector3(0, -(eyeSpan || .03) * .8, 0)) : this.head.getWorldPosition(new THREE.Vector3());
    // Rocketbox heads face -X (eyes span Z). Derive distance from the actual
    // inter-eye measurement so model scale can never turn a head crop into a
    // body shot. The generic rig remains gated; this is its clean calibration.
    const horizontalFov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect);
    const headWidth = (eyeSpan || .06) * 5.0;
    const distance = headWidth / (2 * Math.tan(horizontalFov / 2) * .8);
    this.camera.position.copy(target).add(new THREE.Vector3(-distance, 0, 0)); this.camera.lookAt(target); this.ready = true; return true;
  }
  update(blend = {}, gaze = {}, performance = {}) {
    if (!this.ready) return; const turn = THREE.MathUtils.clamp((performance.turn || 0) * .34 + (gaze.x || 0) * .08, -.34, .34); const nod = THREE.MathUtils.clamp((performance.nod || 0) * .18 + (gaze.y || 0) * -.05, -.18, .18);
    this.poseRoot.rotation.set(this.baseRotation.x + nod, this.baseRotation.y + turn, this.baseRotation.z + (performance.lean || 0) * .06);
    for (const mesh of this.morphs) for (const [name, value] of Object.entries(blend)) { const i = mesh.morphTargetDictionary[name]; if (i !== undefined) mesh.morphTargetInfluences[i] = THREE.MathUtils.clamp(value || 0, 0, 1); }
    this.renderer.render(this.scene, this.camera);
  }
}
