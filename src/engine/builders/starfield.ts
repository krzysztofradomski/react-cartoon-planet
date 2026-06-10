/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import * as THREE from 'three';

// Subtle spectral palette — mostly white, with cool and warm tints like a real
// night sky. Indices weighted toward white so the tints read as accents.
const STAR_PALETTE = ['#ffffff', '#ffffff', '#ffffff', '#cfe4ff', '#aac6ff', '#ffe9c4', '#ffd9a8'];

export function buildStarfield() {
  const N = 2400;
  const positions = new Float32Array(N * 3);
  const colors = new Float32Array(N * 3);
  const sizes = new Float32Array(N);
  const twinkle = new Float32Array(N * 2); // x: phase, y: speed

  const v = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1)
      .normalize()
      .multiplyScalar(50 + Math.random() * 30);
    positions[i * 3] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;

    c.set(STAR_PALETTE[(Math.random() * STAR_PALETTE.length) | 0]);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;

    // Mostly faint pinpricks with a sprinkling of bright "hero" stars.
    sizes[i] = Math.random() < 0.88 ? 0.6 + Math.random() * 0.9 : 1.8 + Math.random() * 1.7;

    twinkle[i * 2] = Math.random() * Math.PI * 2;
    twinkle[i * 2 + 1] = 0.4 + Math.random() * 1.5;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
  geo.setAttribute('aTwinkle', new THREE.Float32BufferAttribute(twinkle, 2));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uPixelRatio: { value: 1 },
    },
    vertexShader: `
        attribute float aSize;
        attribute vec2 aTwinkle;
        uniform float uTime;
        uniform float uPixelRatio;
        varying vec3 vColor;
        varying float vTwinkle;
        void main() {
          vColor = color;
          vTwinkle = 0.72 + 0.28 * sin(uTime * aTwinkle.y + aTwinkle.x);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelRatio * (120.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
    fragmentShader: `
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vTwinkle;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          // Bright core with a soft halo so big stars bloom instead of
          // rendering as hard squares.
          float core = smoothstep(0.5, 0.06, d);
          float halo = smoothstep(0.5, 0.0, d) * 0.35;
          float a = (core + halo) * vTwinkle * uOpacity;
          if (a < 0.004) discard;
          gl_FragColor = vec4(vColor, a);
        }`,
  });

  return new THREE.Points(geo, mat);
}
