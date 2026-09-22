import * as THREE from 'three';

// Classic noise-based "dark fire" shader - tuned toward deep reds/purples
// rather than bright orange, to match the Evil Queen mood rather than a
// campfire. Swap the palette in fragmentShader (the `fireColor` mix) for
// different moods later (e.g. green fire, blue fire).

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uIntensity;

  // Simplex-ish value noise (cheap, good enough for stylized fire)
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 uv = vUv;

    // Fire rises: scroll noise upward over time, taper intensity toward top
    vec2 noiseCoord = vec2(uv.x * 3.0, uv.y * 5.0 - uTime * 1.4);
    float n = fbm(noiseCoord);

    // Concentrate flame toward the bottom/center, fading to black at edges
    float verticalMask = smoothstep(1.0, 0.15, uv.y);
    float horizontalMask = 1.0 - smoothstep(0.15, 0.55, abs(uv.x - 0.5));
    float intensity = n * verticalMask * horizontalMask;
    intensity = pow(clamp(intensity, 0.0, 1.0), 1.6);

    // Dark, regal palette: near-black -> deep purple -> ember red -> pale gold core
    vec3 col = vec3(0.0);
    col = mix(col, vec3(0.20, 0.02, 0.30), smoothstep(0.05, 0.35, intensity));
    col = mix(col, vec3(0.55, 0.05, 0.10), smoothstep(0.30, 0.60, intensity));
    col = mix(col, vec3(0.95, 0.55, 0.20), smoothstep(0.65, 0.95, intensity));

    gl_FragColor = vec4(col * uIntensity, 1.0);
  }
`;

export function createFirePlane(width, height) {
  const geometry = new THREE.PlaneGeometry(width, height, 1, 1);
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(width, height) },
      uIntensity: { value: 1 }
    }
  });
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}
