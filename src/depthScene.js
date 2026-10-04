import * as THREE from 'three';

export function createDepthScene(scene) {
  const root = new THREE.Group();
  root.name = 'depth-room';
  scene.add(root);

  // Thin world-space lines make head parallax visible over pure black.
  // No filled walls, gradients, or glow emit light behind the glass.
  const depthLines = new THREE.Group();
  depthLines.visible = false;
  root.add(depthLines);
  const frontMaterial = new THREE.LineBasicMaterial({ color: 0xa8c7c0, transparent: true, opacity: .38, depthWrite: false });
  const backMaterial = new THREE.LineBasicMaterial({ color: 0x829a95, transparent: true, opacity: .25, depthWrite: false });
  const corners = z => [
    new THREE.Vector3(-1.325, -2.36, z), new THREE.Vector3(1.325, -2.36, z),
    new THREE.Vector3(1.325, 2.36, z), new THREE.Vector3(-1.325, 2.36, z)
  ];
  const front = corners(-1.1);
  const back = corners(-4.6);
  depthLines.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(front), frontMaterial));
  depthLines.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(back), backMaterial));
  for (let i = 0; i < front.length; i++) {
    depthLines.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([front[i], back[i]]), backMaterial));
  }
  const avatarPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 1.62),
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  avatarPlane.position.set(0, -.26, -2.16);
  avatarPlane.visible = false; root.add(avatarPlane);
  let avatarSource = null, avatarStage = null, avatarContext = null, avatarTexture = null;
  let depthEnabled = false;
  let mode = 'portal';
  let lastAvatarUploadAt = -Infinity;
  let avatarAspect = 0;
  return {
    root,
    setMode(nextMode) {
      mode = nextMode;
      root.visible = nextMode !== 'ar';
      avatarPlane.visible = depthEnabled && mode === 'portal' && Boolean(avatarSource);
    },
    setDepthEnabled(enabled) {
      depthEnabled = Boolean(enabled);
      depthLines.visible = depthEnabled;
      avatarPlane.visible = depthEnabled && mode === 'portal' && Boolean(avatarSource);
    },
    setAvatarCanvas(canvas) {
      avatarSource = canvas || null;
      avatarTexture?.dispose();
      if (!avatarSource) { avatarPlane.visible = false; return; }
      avatarStage = document.createElement('canvas');
      avatarStage.width = 1024; avatarStage.height = 1536;
      avatarContext = avatarStage.getContext('2d');
      avatarTexture = new THREE.CanvasTexture(avatarStage);
      avatarTexture.colorSpace = THREE.SRGBColorSpace;
      avatarPlane.material.map = avatarTexture;
      avatarPlane.material.needsUpdate = true;
      avatarPlane.visible = depthEnabled && mode === 'portal';
      lastAvatarUploadAt = -Infinity;
    },
    update(dt, elapsed, head) {
      if (avatarSource?.width && avatarSource?.height && avatarContext && avatarTexture &&
          depthEnabled && mode === 'portal' && elapsed - lastAvatarUploadAt >= 1 / 30) {
        lastAvatarUploadAt = elapsed;
        // The face canvas already has the host's portrait aspect ratio. Fit it
        // into its texture instead of stretching it into a square again.
        const ratio = avatarSource.width / avatarSource.height;
        if (Math.abs(ratio - avatarAspect) > .001) {
          avatarAspect = ratio;
          avatarPlane.geometry.dispose();
          avatarPlane.geometry = new THREE.PlaneGeometry(1.62 * ratio, 1.62);
        }
        avatarContext.clearRect(0, 0, 1024, 1536);
        avatarContext.drawImage(avatarSource, 0, 0, 1024, 1536);
        avatarTexture.needsUpdate = true;
      }
    }
  };
}
