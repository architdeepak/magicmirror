import * as THREE from 'three';
import { createFirePlane } from './fireShader.js';

export function createDepthScene(scene) {
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
  root.add(halo);

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
  root.add(innerHalo);

  const particles = makeParticles(180);
  root.add(particles);

  let mode = 'portal';
  return {
    root,
    fire,
    setMode(nextMode) {
      mode = nextMode;
      root.visible = nextMode !== 'ar';
      lineMaterial.opacity = nextMode === 'mirror' ? 0.08 : 0.19;
    },
    update(dt, elapsed, head) {
      fire.material.uniforms.uTime.value += dt;
      corridor.rotation.z = Math.sin(elapsed * 0.09) * 0.008;
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
