import { displayProfile } from './displayQuality.js';
import * as THREE from 'three';
import { createFirePlane } from './fireShader.js';

export function createDepthScene(scene) {
  let avatarSourceRevision = null;let textureSize=1536;
  const root = new THREE.Group();
  root.name = 'depth-room';
  scene.add(root);

  const fire = createFirePlane(7.2, 12.8);
  fire.position.set(0, -0.25, -5.8);
  root.add(fire);

  const corridor = new THREE.Group();
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x8a5cc7,
    transparent: true,
    opacity: 0.19,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  for (let z = -5.4; z <= 0.2; z += 0.48) {
    const depthScale = 1 + Math.abs(z) * 0.08;
    corridor.add(rectangleLine(3.2 * depthScale, 5.6 * depthScale, z, lineMaterial));
  }

  const vanishing = [
    [-1.65, -2.9], [1.65, -2.9], [-1.65, 2.9], [1.65, 2.9],
    [0, -2.9], [0, 2.9], [-1.65, 0], [1.65, 0]
  ];
  for (const [x, y] of vanishing) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, y, 0.2),
      new THREE.Vector3(x * 1.42, y * 1.35, -5.4)
    ]);
    corridor.add(new THREE.Line(geometry, lineMaterial));
  }
  root.add(corridor);

  // This is intentionally a real bounded volume, not an abstract tunnel: its
  // front, side and top planes make the virtual-window illusion legible before
  // head tracking even begins to move it.
  const cube = new THREE.Group();
  cube.name = 'depth-cube';
  const cubeGeometry = new THREE.BoxGeometry(2.9, 4.85, 2.45);
  const cubeMaterials = [
    new THREE.MeshBasicMaterial({ color: 0x78ffd1, transparent: true, opacity: .11, side: THREE.DoubleSide, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0x593eaf, transparent: true, opacity: .14, side: THREE.DoubleSide, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0xb6ffdc, transparent: true, opacity: .09, side: THREE.DoubleSide, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0x26194e, transparent: true, opacity: .16, side: THREE.DoubleSide, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0xb5ffd4, transparent: true, opacity: .075, side: THREE.DoubleSide, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0x101626, transparent: true, opacity: .18, side: THREE.DoubleSide, depthWrite: false })
  ];
  const cubeFaces = new THREE.Mesh(cubeGeometry, cubeMaterials);
  cubeFaces.position.set(0, .1, -2.25);
  cube.add(cubeFaces);
  const cubeEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(cubeGeometry),
    new THREE.LineBasicMaterial({ color: 0xb5ffd4, transparent: true, opacity: .94, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  cubeEdges.position.copy(cubeFaces.position);
  cube.add(cubeEdges);
  cube.visible = false;
  root.add(cube);
  const infoWall = makeInfoWall(new THREE.Vector3(0, 1.18, -3.46));
  cube.add(infoWall.group);
  const faceDecorations = [
    makeLattice(1.86, 3.7, new THREE.Vector3(-1.43, .1, -2.25), new THREE.Euler(0, Math.PI / 2, 0)),
    makeLattice(1.86, 3.7, new THREE.Vector3(1.43, .1, -2.25), new THREE.Euler(0, -Math.PI / 2, 0)),
    makeLattice(2.25, 2.05, new THREE.Vector3(0, 2.47, -2.25), new THREE.Euler(Math.PI / 2, 0, 0)),
    makeLattice(2.25, 2.05, new THREE.Vector3(0, -2.47, -2.25), new THREE.Euler(-Math.PI / 2, 0, 0))
  ];
  faceDecorations.forEach((wall) => cube.add(wall));
  const avatarPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 1.62), new THREE.MeshBasicMaterial({ transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide }));
  avatarPlane.name = 'cube-avatar';
  avatarPlane.position.set(0, -.26, -2.16); avatarPlane.visible = false; cube.add(avatarPlane);
  let avatarSource = null; let avatarStage = null; let avatarStageContext = null; let avatarTexture = null;

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(1.08, 1.115, 96),
    new THREE.MeshBasicMaterial({
      color: 0xe0bd70,
      transparent: true,
      opacity: 0.36,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  halo.position.set(0, 0.45, -1.55);
  halo.visible = false;

  const innerHalo = new THREE.Mesh(
    new THREE.RingGeometry(1.27, 1.285, 96),
    new THREE.MeshBasicMaterial({
      color: 0x8056cb,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  innerHalo.position.copy(halo.position);
  innerHalo.visible = false;

  const particles = makeParticles(180);
  root.add(particles);

  let mode = 'portal';
  let depthEnabled = false;
  let avatarAnchor = { x: 0, y: -.26 };
  return {
    root,
    fire,
    setMode(nextMode) {
      mode = nextMode;
      avatarPlane.visible = Boolean(depthEnabled && avatarSource && nextMode === 'portal');
      root.visible = nextMode !== 'ar';
      lineMaterial.opacity = nextMode === 'mirror' ? 0.08 : 0.19;
    },
    setDepthEnabled(enabled) {
      depthEnabled = Boolean(enabled);
      avatarPlane.visible = Boolean(depthEnabled && avatarSource && mode === 'portal');
      cube.visible = depthEnabled;
      corridor.visible = depthEnabled;
      halo.visible = false;
      innerHalo.visible = false;
    },
    setQuality(id) {
      const next=displayProfile(id).depthTexture;if(next===textureSize)return;textureSize=next;avatarSourceRevision=null;
      if(avatarStage){avatarStage.width=textureSize;avatarStage.height=textureSize;avatarTexture.needsUpdate=true;}
    },
    setCubeContent(content = {}) { infoWall.draw(content); },
    setAvatarPosition(position) {
      avatarAnchor = { center: { x: 0, y: -.26 }, left: { x: -.95, y: -.26 }, right: { x: .95, y: -.26 }, upper: { x: 0, y: .72 }, lower: { x: 0, y: -1.2 } }[position] || { x: 0, y: -.26 };
    },
    setAvatarCanvas(canvas) {
      avatarSourceRevision = null;
      avatarSource = canvas || null;
      if (!avatarSource) { avatarPlane.visible = false; return; }
      // Copy into a fixed-size staging surface. Uploading a resizing DOM canvas
      // directly caused Chromium texture-overflow errors in the remote build.
      // The portrait assets are ~1.2K square. A 1K staging surface retains
      // their detail on a 4K TV while avoiding a resizing texture each frame.
      avatarStage = document.createElement('canvas'); avatarStage.width = textureSize; avatarStage.height = textureSize;
      avatarStageContext = avatarStage.getContext('2d');
      avatarTexture?.dispose(); avatarTexture = new THREE.CanvasTexture(avatarStage); avatarTexture.colorSpace = THREE.SRGBColorSpace;
      avatarPlane.material.map = avatarTexture; avatarPlane.material.needsUpdate = true; avatarPlane.visible = depthEnabled && mode === 'portal';
    },
    update(dt, elapsed, head) {
      fire.material.uniforms.uTime.value += dt;
      corridor.rotation.z = depthEnabled ? 0 : Math.sin(elapsed * 0.09) * 0.008;
      cube.rotation.y = head.x * -.045;
      cube.rotation.x = head.y * .025;
      infoWall.update(head);
      avatarPlane.position.x = avatarAnchor.x + head.x * -.035;
      avatarPlane.position.y = avatarAnchor.y - head.y * .025;
      avatarPlane.rotation.y = head.x * .055;
      avatarPlane.rotation.x = -head.y * .025;
      if (depthEnabled && avatarPlane.visible && avatarSource?.width && avatarStageContext && avatarTexture
        && (avatarSource._mirrorRevision == null || avatarSource._mirrorRevision !== avatarSourceRevision)) {
        avatarStageContext.clearRect(0, 0, textureSize, textureSize);
        const scale=Math.min(textureSize/avatarSource.width,textureSize/avatarSource.height),w=avatarSource.width*scale,h=avatarSource.height*scale;
        avatarStageContext.drawImage(avatarSource,(textureSize-w)/2,(textureSize-h)/2,w,h);
        avatarTexture.needsUpdate = true;
        avatarSourceRevision = avatarSource._mirrorRevision;
      }
      halo.rotation.z = elapsed * 0.035;
      innerHalo.rotation.z = -elapsed * 0.025;
      halo.material.opacity = 0.28 + Math.sin(elapsed * 1.2) * 0.08;
      particles.rotation.y = elapsed * 0.018;
      particles.position.x = head.x * -0.06;
      particles.position.y = head.y * 0.04;
      if (mode === 'mirror') fire.material.uniforms.uIntensity.value = 0.36;
      else fire.material.uniforms.uIntensity.value = 1;
    }
  };
}

function makeInfoWall(position) {
  // This wall is viewed close-up in depth mode. Keep it above 2K so fine type
  // survives the oblique projection of a 4K portrait display.
  const canvas = document.createElement('canvas'); canvas.width = 3072; canvas.height = 2160;
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
  const group = new THREE.Group(); group.position.copy(position);
  const backing = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.7), new THREE.MeshBasicMaterial({ color: 0x061116, transparent: true, opacity: .93, side: THREE.DoubleSide, depthWrite: false }));
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.34, 1.64), new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false }));
  mesh.position.z = .006; group.add(backing, mesh);
  return {
    group,
    update(head) {
      // A tiny counter-turn keeps the display usable at the viewing extremes
      // without pretending it is a flat HUD glued to the glass.
      group.position.x = head.x * .075;
      group.position.y = 1.18 - head.y * .045;
      group.rotation.y = head.x * .17;
      group.rotation.x = -head.y * .07;
    },
    draw(content) {
      const ctx = canvas.getContext('2d'); ctx.setTransform(3, 0, 0, 3, 0, 0); ctx.clearRect(0, 0, 1024, 720);
      // Two-way glass eats low-contrast midtones. Use a nearly black backing
      // and a restrained, bright keyline instead of making every element glow.
      ctx.fillStyle = 'rgba(1,7,10,.96)'; ctx.fillRect(0, 0, 1024, 720);
      ctx.strokeStyle = 'rgba(202,255,229,.92)'; ctx.lineWidth = 2; ctx.strokeRect(8, 8, 1008, 704);
      ctx.fillStyle = '#b5ffd4'; ctx.font = '600 25px Arial'; ctx.fillText('REFLECT · DEPTH CUBE', 42, 58);
      ctx.fillStyle = '#f4fbff'; ctx.font = '500 92px Arial'; ctx.fillText(content.time || '—', 42, 155);
      ctx.fillStyle = '#b5ffd4'; ctx.font = '500 28px Arial'; ctx.fillText(content.date || '', 45, 204);
      ctx.fillStyle = 'rgba(244,251,255,.88)'; ctx.font = '500 32px Arial'; ctx.fillText(content.weather || '', 45, 263);
      ctx.strokeStyle = 'rgba(181,255,212,.32)'; ctx.beginPath(); ctx.moveTo(42, 294); ctx.lineTo(982, 294); ctx.stroke();
      ctx.fillStyle = '#b5ffd4'; ctx.font = '600 22px Arial'; ctx.fillText('FROM THE GLASS', 42, 335);
      ctx.fillStyle = '#f4fbff'; ctx.font = '500 30px Arial'; drawWrapped(ctx, String(content.quote || '').replace(/[“”]/g, ''), 42, 385, 940, 38, 2);
      texture.needsUpdate = true;
    }
  };
}

function makeLattice(width, height, position, rotation) {
  const points = []; const columns = 5; const rows = 9;
  for (let i = 0; i <= columns; i += 1) { const x = -width / 2 + (i / columns) * width; points.push(x, -height / 2, 0, x, height / 2, 0); }
  for (let i = 0; i <= rows; i += 1) { const y = -height / 2 + (i / rows) * height; points.push(-width / 2, y, 0, width / 2, y, 0); }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const mesh = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x9b7bff, transparent: true, opacity: .46, blending: THREE.AdditiveBlending, depthWrite: false }));
  mesh.position.copy(position); mesh.rotation.copy(rotation); return mesh;
}

function drawWrapped(ctx, text, x, y, width, lineHeight, maxLines) {
  const words = text.split(/\s+/); let line = ''; let lines = 0;
  for (const word of words) { const next = `${line} ${word}`.trim(); if (ctx.measureText(next).width > width && line) { ctx.fillText(line, x, y); y += lineHeight; lines += 1; if (lines >= maxLines) return; line = word; } else line = next; }
  if (line && lines < maxLines) ctx.fillText(line, x, y);
}

function rectangleLine(width, height, z, material) {
  const hw = width / 2;
  const hh = height / 2;
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-hw, -hh, z), new THREE.Vector3(hw, -hh, z),
    new THREE.Vector3(hw, hh, z), new THREE.Vector3(-hw, hh, z),
    new THREE.Vector3(-hw, -hh, z)
  ]);
  return new THREE.Line(geometry, material);
}

function makeParticles(count) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const ember = new THREE.Color(0xe35b38);
  const violet = new THREE.Color(0x8b64ce);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 4.6;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 7.2;
    positions[i * 3 + 2] = -Math.random() * 5.2;
    const color = Math.random() > 0.42 ? ember : violet;
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({
    size: 0.025,
    transparent: true,
    opacity: 0.72,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
}
