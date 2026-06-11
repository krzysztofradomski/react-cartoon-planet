/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import * as THREE from 'three';
import { lngLatToVec3, hash } from '../geo/math';
import { buildMapCanvas } from './mapCanvas';

// Render-order plan (markers sit at 5 and must stay readable on the night
// side): surface 0 < dot clouds 2 < cloud layer 3 < terminator 4 <
// city lights 4.5 ≤ markers 5. Everything here is depthWrite:false so the
// later-ordered marker meshes always draw over it.
const CLOUDS_RENDER_ORDER = 3;
const TERMINATOR_RENDER_ORDER = 4;
const CITY_LIGHTS_RENDER_ORDER = 4.5;

/**
 * Translucent shadow hemisphere. Sits above the cloud layer so clouds darken
 * with the ground beneath them; the camera is inside it at ground level, where
 * its front faces are culled away (and its opacity is faded out anyway).
 */
export function buildTerminator(sunDir: THREE.Vector3) {
  const geo = new THREE.SphereGeometry(1.03, 64, 48);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uSunDir: { value: sunDir },
      uOpacity: { value: 0 },
    },
    vertexShader: `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vWorldNormal;
        void main() {
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
    fragmentShader: `
        #include <common>
        #include <logdepthbuf_pars_fragment>
        uniform vec3 uSunDir;
        uniform float uOpacity;
        varying vec3 vWorldNormal;
        void main() {
          #include <logdepthbuf_fragment>
          float sun = dot(normalize(vWorldNormal), normalize(uSunDir));
          // Soft dusk band around sun=0, deepening quickly into the night side
          // so the shadow reads through the additive atmosphere glow and bloom.
          float night = 1.0 - smoothstep(-0.1, 0.18, sun);
          gl_FragColor = vec4(vec3(0.004, 0.008, 0.024), night * uOpacity);
        }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = TERMINATOR_RENDER_ORDER;
  mesh.userData.isTerminator = true;
  return mesh;
}

/**
 * Warm point lights scattered over land, visible only on the night side.
 * Land is sampled from the continent polygons via an offscreen mask canvas.
 */
export function buildCityLights(continents = [], pixelRatio = 1) {
  const width = 1024;
  const height = 512;
  const canvas = buildMapCanvas(continents, {
    width,
    height,
    landColor: '#ffffff',
    oceanColor: '#000000',
    drawOutline: false,
  });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const pixels = ctx.getImageData(0, 0, width, height).data;

  const positions = [];
  const colors = [];
  const sizes = [];
  const warm = [new THREE.Color('#ffd9a0'), new THREE.Color('#ffc46b'), new THREE.Color('#fff2cc')];

  // Cities cluster in a habitable latitude band; jitter breaks up the grid.
  for (let lat = -58; lat <= 72; lat += 0.9) {
    const cosLat = Math.max(0.1, Math.cos((lat * Math.PI) / 180));
    for (let lng = -180; lng < 180; lng += 0.9 / cosLat) {
      if (hash(lng * 3.1, lat * 2.7) < 0.66) continue;
      const jLng = lng + (hash(lng, lat) - 0.5) * 0.8;
      const jLat = lat + (hash(lat, lng) - 0.5) * 0.8;
      const x = Math.floor(((jLng + 180) / 360) * (width - 1));
      const y = Math.floor(((90 - jLat) / 180) * (height - 1));
      if (pixels[((y * width + x) * 4)] < 128) continue;

      const v = lngLatToVec3(jLng, jLat, 1.0015);
      positions.push(v.x, v.y, v.z);
      const c = warm[(hash(jLng * 1.3, jLat * 1.9) * warm.length) | 0];
      colors.push(c.r, c.g, c.b);
      sizes.push(hash(jLng * 2.2, jLat * 0.7) > 0.93 ? 1.7 + hash(jLat, jLng) : 0.7 + hash(jLng, jLat) * 0.7);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    uniforms: {
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uOpacity: { value: 0 },
      uPixelRatio: { value: pixelRatio },
    },
    vertexShader: `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        attribute float aSize;
        uniform vec3 uSunDir;
        uniform float uPixelRatio;
        varying vec3 vColor;
        varying float vNight;
        void main() {
          vColor = color;
          vec3 worldNormal = normalize(mat3(modelMatrix) * normalize(position));
          vNight = 1.0 - smoothstep(-0.15, 0.05, dot(worldNormal, normalize(uSunDir)));
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelRatio * (6.4 / max(0.05, -mv.z));
          gl_Position = projectionMatrix * mv;
          #include <logdepthbuf_vertex>
        }`,
    fragmentShader: `
        #include <common>
        #include <logdepthbuf_pars_fragment>
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vNight;
        void main() {
          #include <logdepthbuf_fragment>
          vec2 uv = gl_PointCoord - 0.5;
          float a = (1.0 - smoothstep(0.08, 0.5, length(uv))) * vNight * uOpacity;
          if (a < 0.004) discard;
          gl_FragColor = vec4(vColor, a);
        }`,
  });

  const points = new THREE.Points(geo, mat);
  points.renderOrder = CITY_LIGHTS_RENDER_ORDER;
  points.userData.isCityLights = true;
  return points;
}

function buildCloudCanvas() {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  // Soft puff clusters, biased away from the poles and stretched along
  // latitude so they read as weather bands rather than confetti.
  const SYSTEMS = 150;
  for (let s = 0; s < SYSTEMS; s++) {
    const cx = hash(s * 1.7, s * 0.3) * width;
    const band = (hash(s * 2.9, s * 1.1) - 0.5) * 2; // -1..1
    const cy = height * (0.5 + band * 0.36);
    const puffs = 4 + ((hash(s, s * 3.3) * 7) | 0);
    for (let p = 0; p < puffs; p++) {
      const px = cx + (hash(s * 5.1, p * 2.3) - 0.5) * 130;
      const py = cy + (hash(p * 4.7, s * 1.9) - 0.5) * 34;
      const r = 9 + hash(s * 0.7, p * 6.1) * 30;
      const alpha = 0.05 + hash(p * 1.3, s * 2.1) * 0.1;
      const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
      grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
      grad.addColorStop(0.7, `rgba(255,255,255,${alpha * 0.5})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(2.1, 1);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  return canvas;
}

/** Slowly drifting translucent cloud sphere just above the surface. */
export function buildCloudLayer() {
  const texture = new THREE.CanvasTexture(buildCloudCanvas());
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;

  const geo = new THREE.SphereGeometry(1.018, 80, 56);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = CLOUDS_RENDER_ORDER;
  mesh.userData.isCloudLayer = true;
  return mesh;
}
