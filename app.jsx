// Globe app — Three.js + React. Cartoon planet zoom from space to meters.
const { useEffect, useRef, useState } = React;

// =============================================================================
// Constants
// =============================================================================
const EARTH_RADIUS_M = 6_371_000;
// Land sits at radius 1.0 — that's the canonical "surface". Ocean ~6km below so it
// never z-fights with land at any zoom level. Camera flies above land.
const R_LAND         = 1.0;
const R_OCEAN        = 0.9985;
const R_OUTLINE      = 0.9994;   // strip BELOW land — depth-tested: hidden where land covers, visible outside
const R_LAND_OUTLINE = 1.0;
const R_CITY         = 1.0;
const R_DETAIL       = 1.0;
const OUTLINE_DEG    = 1.0;      // strip half-width in degrees of lng/lat (visible rim ≈ this much)
const MIN_RADIUS     = 1.0 + 5 / EARTH_RADIUS_M;
const MAX_RADIUS     = 6.0;
const OCEAN_COLOR    = '#1f5fea';
const START_VIEW_KEY = 'cartoonPlanetStartView';
const RENDER_MODE_KEY = 'cartoonPlanetRenderMode';
const START_VIEWS = {
  globe:  { lng: 0, lat: 20, alt_m: 14_000_000 },
  ground: { lng: 0, lat: 20, alt_m: 1_500 },
};
// =============================================================================
// Pluggable Render Mode Registry
// =============================================================================
const PlanetRenderRegistry = {
  _modes: new Map(),
  _listeners: [],

  register(mode) {
    if (!mode.id || !mode.build) {
      console.error("Invalid render mode. 'id' and 'build()' are required.");
      return;
    }
    this._modes.set(mode.id, mode);
    this._notify();
  },

  get(id) {
    return this._modes.get(id);
  },

  getAll() {
    return Array.from(this._modes.values());
  },

  onChange(listener) {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  },

  _notify() {
    for (const listener of this._listeners) {
      try { listener(); } catch (e) { console.error("Listener error", e); }
    }
  },

  build(id, continents, options) {
    const mode = this.get(id) || this.get('surface');
    if (!mode) return new THREE.Group();
    const group = mode.build(continents, options);
    group.userData.mode = id;
    return group;
  },

  animate(id, group, context) {
    const mode = this.get(id);
    if (mode && mode.animate) {
      mode.animate(group, context);
    }
  }
};
window.PlanetRenderRegistry = PlanetRenderRegistry;
const DEFAULT_MARKERS = [
  {
    id: 'nyc',
    label: 'New York',
    lng: -74.006,
    lat: 40.7128,
    shape: 'orb',
    color: '#ff6b5f',
    size: 0.024,
  },
  {
    id: 'london',
    label: 'London cube',
    lng: -0.1276,
    lat: 51.5072,
    shape: 'cube',
    color: '#f3ead2',
    size: 0.026,
  },
  {
    id: 'tokyo',
    label: 'Tokyo tower',
    lng: 139.6917,
    lat: 35.6895,
    shape: 'bar',
    color: '#39ffd7',
    size: 0.02,
    height: 0.07,
  },
  {
    id: 'sydney',
    label: 'Sydney orb',
    lng: 151.2093,
    lat: -33.8688,
    shape: 'orb',
    color: '#b36cff',
    size: 0.023,
  },
];

// =============================================================================
// Headless State Store & Controller
// =============================================================================
class GlobeStateStore {
  constructor(initialState = {}) {
    this.state = {
      renderMode: 'surface',
      startView: 'globe',
      markers: window.CARTOON_PLANET_MARKERS || DEFAULT_MARKERS,
      placingMode: false,
      hud: { altitude: 0, scaleLabel: '0 m', focusLat: 0, focusLng: 0, scaleBarPx: 40, scaleBarLabel: '0 m' },
      markerLabels: [],
      linksEnabled: true,
      ...initialState
    };
    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  setState(nextStateOrFn) {
    const nextState = typeof nextStateOrFn === 'function' ? nextStateOrFn(this.state) : nextStateOrFn;
    this.state = { ...this.state, ...nextState };
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach(listener => {
      try { listener(this.state); } catch (e) { console.error("GlobeStateStore subscriber error", e); }
    });
  }
}

class GlobeController {
  constructor(store, stateRef) {
    this.store = store;
    this.stateRef = stateRef;
  }

  getState() {
    return this.store.getState();
  }

  subscribe(listener) {
    return this.store.subscribe(listener);
  }

  setRenderMode(mode) {
    if (!PlanetRenderRegistry.get(mode)) return;
    this.store.setState({ renderMode: mode });
    try {
      localStorage.setItem('cartoonPlanetRenderMode', mode);
    } catch {}
    if (this.stateRef.current && this.stateRef.current.setRenderMode) {
      this.stateRef.current.setRenderMode(mode);
    }
  }

  setStartView(view) {
    this.store.setState({ startView: view });
    try {
      localStorage.setItem('cartoonPlanetStartView', view);
    } catch {}
    const start = START_VIEWS[view];
    if (start) {
      this.flyTo(start.lng, start.lat, start.alt_m);
    }
  }

  setMarkers(list) {
    const markers = Array.isArray(list) ? list : [];
    this.store.setState({ markers });
    if (this.stateRef.current && this.stateRef.current.setMarkers) {
      this.stateRef.current.setMarkers(markers);
    }
  }

  addMarker(label, lat, lng, shape = 'orb', color = '#ff5e3a', size = 0.024, isOrbital = false, altitude = 1.18, orbitNodeA = '', orbitNodeB = '') {
    const newMarker = {
      id: 'custom_' + Date.now(),
      label: label || `Marker at ${lat.toFixed(1)}°, ${lng.toFixed(1)}°`,
      lng: Number(lng),
      lat: Number(lat),
      shape,
      color,
      size: Number(size),
      isOrbital: !!isOrbital,
      altitude: Number(altitude),
      orbitNodeA,
      orbitNodeB
    };
    const currentMarkers = this.store.getState().markers;
    this.setMarkers([...currentMarkers, newMarker]);
    return newMarker;
  }

  removeMarker(id) {
    const currentMarkers = this.store.getState().markers;
    this.setMarkers(currentMarkers.filter(m => m.id !== id));
  }

  setLinksEnabled(enabled) {
    this.store.setState({ linksEnabled: !!enabled });
    if (this.stateRef.current && this.stateRef.current.setMarkers) {
      this.stateRef.current.setMarkers(this.store.getState().markers);
    }
  }

  startPlacing() {
    this.store.setState({ placingMode: true });
  }

  cancelPlacing() {
    this.store.setState({ placingMode: false });
  }

  flyTo(lng, lat, alt_m) {
    const r = 1 + alt_m / EARTH_RADIUS_M;
    if (this.stateRef.current && this.stateRef.current.controls) {
      this.stateRef.current.controls.flyTo(lng, lat, r, 1800);
    }
  }

  flyToMarker(id) {
    const marker = this.store.getState().markers.find(m => m.id === id);
    if (marker) {
      this.flyTo(marker.lng, marker.lat, 1500);
    }
  }

  // --- Internals for Three.js hooks ---
  updateHUD(hudData) {
    this.store.setState({ hud: hudData });
  }

  updateMarkerLabels(labels) {
    this.store.setState({ markerLabels: labels });
  }
}

const globeStateRef = { current: {} };
const globeStoreInstance = new GlobeStateStore({
  renderMode: (() => {
    try {
      const stored = localStorage.getItem('cartoonPlanetRenderMode');
      return stored && PlanetRenderRegistry.get(stored) ? stored : 'surface';
    } catch {
      return 'surface';
    }
  })(),
  startView: (() => {
    try {
      return localStorage.getItem('cartoonPlanetStartView') === 'ground' ? 'ground' : 'globe';
    } catch {
      return 'globe';
    }
  })()
});
window.GlobeController = new GlobeController(globeStoreInstance, globeStateRef);

// =============================================================================
// Geometry helpers
// Geometry helpers
// =============================================================================
function lngLatToVec3(lng, lat, radius = 1) {
  const phi   = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
     radius * Math.cos(phi),
     radius * Math.sin(phi) * Math.sin(theta)
  );
}

function vec3ToLngLat(v) {
  const r   = v.length();
  const lat = 90 - (Math.acos(v.y / r) * 180 / Math.PI);
  let lng   = (Math.atan2(v.z, -v.x) * 180 / Math.PI) - 180;
  while (lng < -180) lng += 360;
  while (lng >  180) lng -= 360;
  return { lat, lng };
}

// Build local tangent-space basis at a lat/lng on a sphere of given radius.
function tangentFrame(lng, lat, radius) {
  const center = lngLatToVec3(lng, lat, radius);
  const up     = center.clone().normalize();
  const north  = lngLatToVec3(lng, lat + 0.0001, radius).sub(center).normalize();
  const east   = new THREE.Vector3().crossVectors(up, north).normalize().negate();
  const northC = new THREE.Vector3().crossVectors(east, up).normalize();
  return { center, up, east, north: northC };
}

// Densify a polygon ring so straight (lng,lat) edges curve on the sphere.
function subdivideRing(ring, maxDegPerSeg = 1.5) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    out.push(a);
    const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const segs = Math.max(1, Math.ceil(dist / maxDegPerSeg));
    for (let s = 1; s < segs; s++) {
      const t = s / segs;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

function cleanRing(ring) {
  const out = [];
  for (const point of ring) {
    const lng = point[0];
    const lat = point[1];
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const prev = out[out.length - 1];
    if (prev && prev[0] === lng && prev[1] === lat) continue;
    out.push([lng, lat]);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 1 && first[0] === last[0] && first[1] === last[1]) out.pop();
  return out;
}

// =============================================================================
// Builders
// =============================================================================
// Recursively split a 2D triangle by midpoint subdivision until every edge is
// shorter than `maxLen` degrees. Returns flat arrays of (lng,lat) verts + indices.
function subdivideTriangles(verts2D, idx, maxLen = 8) {
  const out2D = verts2D.slice();
  const outIdx = [];
  // edgeMidCache keyed by "a_b" with a<b → midpoint vertex index
  const cache = new Map();
  function midpoint(a, b) {
    const k = a < b ? a + '_' + b : b + '_' + a;
    let m = cache.get(k);
    if (m !== undefined) return m;
    const ax = out2D[a*2],   ay = out2D[a*2+1];
    const bx = out2D[b*2],   by = out2D[b*2+1];
    m = out2D.length / 2;
    out2D.push((ax+bx)/2, (ay+by)/2);
    cache.set(k, m);
    return m;
  }
  function dist(a, b) {
    const dx = out2D[a*2] - out2D[b*2];
    const dy = out2D[a*2+1] - out2D[b*2+1];
    return Math.hypot(dx, dy);
  }
  const work = [];
  for (let i = 0; i < idx.length; i += 3) work.push([idx[i], idx[i+1], idx[i+2]]);
  let iters = 0;
  while (work.length) {
    if (++iters > 200000) {
      console.warn('subdivide cap hit; drawing remaining coarse triangles');
      while (work.length) outIdx.push(...work.pop());
      break;
    }
    const [a, b, c] = work.pop();
    const dab = dist(a, b), dbc = dist(b, c), dca = dist(c, a);
    const maxD = Math.max(dab, dbc, dca);
    if (maxD <= maxLen) {
      outIdx.push(a, b, c);
      continue;
    }
    // split the longest edge — leaves a clean fan instead of 1→4 subdivision
    if (dab >= dbc && dab >= dca) {
      const m = midpoint(a, b);
      work.push([a, m, c], [m, b, c]);
    } else if (dbc >= dca) {
      const m = midpoint(b, c);
      work.push([a, b, m], [a, m, c]);
    } else {
      const m = midpoint(c, a);
      work.push([a, b, m], [m, b, c]);
    }
  }
  return { verts: out2D, idx: outIdx };
}

function buildContinentMesh(continent) {
  const positions = [];
  const indices   = [];
  const stripPositions = [];
  const stripIndices   = [];
  let stripBase = 0;

  for (const ringDef of continent.rings) {
    const ring = cleanRing(Array.isArray(ringDef) ? ringDef : ringDef.points);
    const drawOutline = continent.outline !== false && ringDef.outline !== false;
    if (!ring || ring.length < 3) continue;

    const dense = subdivideRing(ring, 2.0);
    const flat  = [];
    for (const [lng, lat] of dense) flat.push(lng, lat);
    const rawTri = earcut(flat);
    // Subdivide so triangle edges <= 8° (so projected triangles hug the sphere)
    const { verts: v2D, idx: triIdx } = subdivideTriangles(flat, rawTri, 8);

    const baseIdx = positions.length / 3;
    for (let i = 0; i < v2D.length; i += 2) {
      const v = lngLatToVec3(v2D[i], v2D[i+1], R_LAND);
      positions.push(v.x, v.y, v.z);
    }
    for (const t of triIdx) indices.push(baseIdx + t);

    // ---- Tangent-space outline strip ------------------------------------
    // Two-sided strip centered on the polygon edge. We don't try to detect
    // winding — instead we generate vertices on BOTH sides of every edge
    // vertex, so the strip straddles the polygon boundary. The strip is
    // rendered ABOVE the land with depthTest/depthWrite OFF, then the green
    // land draws on top with normal depth. The half of the strip inside
    // the polygon gets overwritten by green; the half outside the polygon
    // sits over the ocean and reads as a true cartoon outline rim.
    const n = dense.length;
    const sideA = new Array(n);
    const sideB = new Array(n);
    if (drawOutline) {
      for (let i = 0; i < n; i++) {
        const prev = dense[(i - 1 + n) % n];
        const curr = dense[i];
        const next = dense[(i + 1) % n];
        let txIn  = curr[0] - prev[0], tyIn  = curr[1] - prev[1];
        let txOut = next[0] - curr[0], tyOut = next[1] - curr[1];
        const lIn  = Math.hypot(txIn,  tyIn)  || 1;
        const lOut = Math.hypot(txOut, tyOut) || 1;
        txIn /= lIn; tyIn /= lIn; txOut /= lOut; tyOut /= lOut;
        // bisector perpendicular to the average travel direction
        let nx = (tyIn + tyOut) / 2;
        let ny = -((txIn + txOut) / 2);
        const bl = Math.hypot(nx, ny) || 1;
        nx /= bl; ny /= bl;
        // Scale longitude offset by 1/cos(lat) so the strip width in arc-length
        // stays roughly constant near the poles. Clamped to avoid blow-up.
        const cosLat = Math.max(0.18, Math.cos(curr[1] * Math.PI / 180));
        const dx = nx * OUTLINE_DEG / cosLat;
        const dy = ny * OUTLINE_DEG;
        sideA[i] = [curr[0] + dx, curr[1] + dy];
        sideB[i] = [curr[0] - dx, curr[1] - dy];
      }

      const startIdx = stripBase;
      for (let i = 0; i < n; i++) {
        const va = lngLatToVec3(sideA[i][0], sideA[i][1], R_OUTLINE);
        const vb = lngLatToVec3(sideB[i][0], sideB[i][1], R_OUTLINE);
        stripPositions.push(va.x, va.y, va.z);
        stripPositions.push(vb.x, vb.y, vb.z);
      }
      for (let i = 0; i < n; i++) {
        const a = startIdx + 2 * i;
        const b = startIdx + 2 * i + 1;
        const c = startIdx + 2 * ((i + 1) % n);
        const d = startIdx + 2 * ((i + 1) % n) + 1;
        stripIndices.push(a, b, c, b, d, c);
      }
      stripBase += 2 * n;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat  = new THREE.MeshBasicMaterial({
    color: continent.color,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;

  const group = new THREE.Group();

  // Outline strip — drawn FIRST, no depth interaction, so the green land
  // overwrites the inside half via the framebuffer.
  if (stripIndices.length) {
    const stripGeo = new THREE.BufferGeometry();
    stripGeo.setAttribute('position', new THREE.Float32BufferAttribute(stripPositions, 3));
    stripGeo.setIndex(stripIndices);
    const stripMat = new THREE.MeshBasicMaterial({
      color: 0x0a0a14,
      side: THREE.DoubleSide,
      depthTest:  false,
      depthWrite: false,
    });
    const stripMesh = new THREE.Mesh(stripGeo, stripMat);
    stripMesh.renderOrder = 1;
    group.add(stripMesh);
  }

  group.add(mesh);
  return group;
}

function buildAntarcticaCap(latCap = -67) {
  // Build a fan directly on the sphere from the pole outward — avoids earcut
  // misinterpreting a 360°-spanning polygon as a thin strip.
  const segs = 96;
  const positions = [];
  const indices   = [];

  // Pole vertex
  const pole = lngLatToVec3(0, -89.5, R_LAND);
  positions.push(pole.x, pole.y, pole.z);

  // Outer ring with jagged edge
  const ring = [];
  for (let i = 0; i < segs; i++) {
    const lng = -180 + (360 * i) / segs;
    const wobble = Math.sin(i * 0.6) * 1.4 + Math.cos(i * 1.7) * 0.9;
    const lat = latCap + wobble;
    ring.push([lng, lat]);
    const v = lngLatToVec3(lng, lat, R_LAND);
    positions.push(v.x, v.y, v.z);
  }
  // Triangle fan
  for (let i = 0; i < segs; i++) {
    const a = 1 + i;
    const b = 1 + ((i + 1) % segs);
    indices.push(0, b, a);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ color: '#f4f8fa', side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);

  // Outline along the jagged edge
  const outline = [];
  for (const [lng, lat] of ring) {
    const v = lngLatToVec3(lng, lat, R_LAND_OUTLINE);
    outline.push(v.x, v.y, v.z);
  }
  outline.push(outline[0], outline[1], outline[2]);
  const outlineGeo = new THREE.BufferGeometry();
  outlineGeo.setAttribute('position', new THREE.Float32BufferAttribute(outline, 3));
  const outlineMat = new THREE.LineBasicMaterial({ color: 0x2a2a2a, transparent: true, opacity: 0.45 });

  const group = new THREE.Group();
  group.add(mesh);
  group.add(new THREE.Line(outlineGeo, outlineMat));
  return group;
}

function drawRingOnTexture(ctx, ring, color, width, height) {
  const clean = cleanRing(ring);
  if (clean.length < 3) return;

  ctx.fillStyle = color;
  for (let offset = -360; offset <= 360; offset += 360) {
    ctx.beginPath();
    for (let i = 0; i < clean.length; i++) {
      const lng = clean[i][0] + offset;
      const lat = clean[i][1];
      const x = ((lng + 180) / 360) * width;
      const y = ((90 - lat) / 180) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
}

function strokeRingOnTexture(ctx, ring, width, height, lineWidth, outlineColor = '#0a0a14') {
  const clean = cleanRing(ring);
  if (clean.length < 3) return;

  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (let offset = -360; offset <= 360; offset += 360) {
    ctx.beginPath();
    for (let i = 0; i < clean.length; i++) {
      const lng = clean[i][0] + offset;
      const lat = clean[i][1];
      const x = ((lng + 180) / 360) * width;
      const y = ((90 - lat) / 180) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
}

function outlineWidthForAltitude(alt_m) {
  if (alt_m < 2_000) return 84;
  if (alt_m < 20_000) return 64;
  if (alt_m < 200_000) return 44;
  if (alt_m < 1_000_000) return 28;
  if (alt_m < 4_000_000) return 18;
  return 12;
}

function buildMapCanvas(continents = [], options = {}) {
  const {
    width = 4096,
    height = 2048,
    oceanColor = OCEAN_COLOR,
    landColor = '#3aa94e',
    outlinePx = 12,
    drawOutline = true,
    outlineColor = '#0a0a14',
    landGrid = false,
  } = options;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = OCEAN_COLOR;
  ctx.fillStyle = oceanColor;
  ctx.fillRect(0, 0, width, height);

  for (const continent of continents) {
    const color = landColor || continent.color || '#3aa94e';
    for (const ringDef of continent.rings || []) {
      const ring = Array.isArray(ringDef) ? ringDef : ringDef.points;
      drawRingOnTexture(ctx, ring, color, width, height);
    }
  }

  if (landGrid) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.strokeStyle = 'rgba(255, 46, 234, 0.15)';
    ctx.lineWidth = 4;
    // Draw latitude lines
    for (let lat = -90; lat <= 90; lat += 2.5) {
      const y = ((90 - lat) / 180) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    // Draw longitude lines
    for (let lng = -180; lng <= 180; lng += 2.5) {
      const x = ((lng + 180) / 360) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (drawOutline) {
    for (const continent of continents) {
      if (continent.outline === false) continue;
      for (const ringDef of continent.rings || []) {
        if (ringDef.outline === false) continue;
        const ring = Array.isArray(ringDef) ? ringDef : ringDef.points;
        strokeRingOnTexture(ctx, ring, width, height, outlinePx, outlineColor);
      }
    }
  }
  return canvas;
}

function buildTextureSphere(canvas, radius, options = {}) {
  const {
    opacity = 1,
    transparent = false,
    color = 0xffffff,
  } = options;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  const geo = new THREE.SphereGeometry(radius, 96, 64);
  const mat = new THREE.MeshBasicMaterial({
    color,
    map: texture,
    transparent,
    opacity,
    depthTest: true,
    depthWrite: true,
    side: THREE.FrontSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 0;
  return mesh;
}

function buildDotCloud(continents = [], mode = 'dots') {
  const width = 1024;
  const height = 512;
  const landColor = mode === 'cyberpunk' ? '#ff2eea' : mode === 'hybrid' ? '#23f2bd' : '#42df69';
  const oceanColor = mode === 'cyberpunk' ? '#060010' : mode === 'hybrid' ? '#071223' : '#10295b';
  const canvas = buildMapCanvas(continents, {
    width,
    height,
    landColor,
    oceanColor,
    drawOutline: false,
  });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const positions = [];
  const colors = [];
  const landPoints = [];
  const land = new THREE.Color(mode === 'cyberpunk' ? '#ff42e6' : mode === 'hybrid' ? '#55ffd4' : '#6cff79');
  const ocean = new THREE.Color(mode === 'cyberpunk' ? '#00d8ff' : mode === 'hybrid' ? '#183464' : '#2f78ff');
  const hot = new THREE.Color(mode === 'cyberpunk' ? '#faff70' : '#ff80ff');

  const latStep = mode === 'cyberpunk' ? 1.6 : 2;
  for (let lat = -86; lat <= 86; lat += latStep) {
    const cosLat = Math.max(0.08, Math.cos(lat * Math.PI / 180));
    const lngStep = Math.max(mode === 'cyberpunk' ? 1.9 : 2.4, (mode === 'cyberpunk' ? 2.2 : 2.8) / cosLat);
    for (let lng = -180; lng < 180; lng += lngStep) {
      const x = Math.floor(((lng + 180) / 360) * (width - 1));
      const y = Math.floor(((90 - lat) / 180) * (height - 1));
      const i = (y * width + x) * 4;
      const isLand = mode === 'cyberpunk' ? (pixels[i] > 128) : (pixels[i + 1] > pixels[i + 2] + 12);
      if (mode === 'hybrid' && !isLand && hash(lng, lat) < 0.72) continue;
      if (mode === 'cyberpunk' && !isLand && hash(lng, lat) < 0.46) continue;

      const lift = mode === 'cyberpunk' ? 1.006 : mode === 'hybrid' ? 1.004 : 1.002;
      const v = lngLatToVec3(lng, lat, lift);
      positions.push(v.x, v.y, v.z);

      let color = isLand ? land : ocean;
      if ((mode === 'hybrid' || mode === 'cyberpunk') && isLand && hash(lng * 2.3, lat * 1.7) > (mode === 'cyberpunk' ? 0.94 : 0.965)) color = hot;
      const dim = isLand ? 1 : (mode === 'cyberpunk' ? 0.62 : mode === 'hybrid' ? 0.32 : 0.58);
      colors.push(color.r * dim, color.g * dim, color.b * dim);
      if (isLand && landPoints.length < 1400 && hash(lng * 1.9, lat * 2.1) > 0.88) {
        landPoints.push({ lng, lat });
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    vertexColors: true,
    size: mode === 'cyberpunk' ? 2.6 : mode === 'hybrid' ? 2.2 : 2.0,
    sizeAttenuation: false,
    transparent: true,
    opacity: mode === 'cyberpunk' ? 0.98 : mode === 'hybrid' ? 0.92 : 0.95,
    depthWrite: false,
    blending: mode === 'cyberpunk' ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.renderOrder = 2;
  points.userData.landPoints = landPoints;
  return points;
}

function buildHybridArcs(landPoints = []) {
  const group = new THREE.Group();
  if (landPoints.length < 2) return group;

  const arcColors = [0x39ffd7, 0xb36cff, 0x72a7ff];
  for (let i = 0; i < 34; i++) {
    const a = landPoints[Math.floor(hash(i, 1.7) * landPoints.length)];
    const b = landPoints[Math.floor(hash(i + 19, 4.3) * landPoints.length)];
    if (!a || !b || (Math.abs(a.lng - b.lng) < 12 && Math.abs(a.lat - b.lat) < 8)) continue;
    const start = lngLatToVec3(a.lng, a.lat, 1.015);
    const end = lngLatToVec3(b.lng, b.lat, 1.015);
    const mid = start.clone().add(end).normalize().multiplyScalar(1.25 + hash(i, 9.1) * 0.32);
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(56));
    const mat = new THREE.LineBasicMaterial({
      color: arcColors[i % arcColors.length],
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.renderOrder = 3;
    group.add(line);
  }
  return group;
}

function buildCyberpunkArcs(landPoints = []) {
  const group = new THREE.Group();
  if (landPoints.length < 2) return group;

  const curves = [];
  const arcColors = [0xff2eea, 0x00f5ff, 0xfaff70, 0x7c5cff];
  const arcColorsTHREE = arcColors.map(c => new THREE.Color(c));

  for (let i = 0; i < 58; i++) {
    const a = landPoints[Math.floor(hash(i * 2.1, 11.7) * landPoints.length)];
    const b = landPoints[Math.floor(hash(i + 41, 8.3) * landPoints.length)];
    if (!a || !b || (Math.abs(a.lng - b.lng) < 10 && Math.abs(a.lat - b.lat) < 8)) continue;
    const start = lngLatToVec3(a.lng, a.lat, 1.02);
    const end = lngLatToVec3(b.lng, b.lat, 1.02);
    const mid = start.clone().add(end).normalize().multiplyScalar(1.34 + hash(i, 19.1) * 0.5);
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    curves.push({
      curve,
      color: arcColorsTHREE[i % arcColorsTHREE.length],
    });

    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(64));
    const mat = new THREE.LineBasicMaterial({
      color: arcColors[i % arcColors.length],
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.renderOrder = 4;
    group.add(line);
  }

  // Create flying particles
  if (curves.length > 0) {
    const pCount = 50;
    const pGeo = new THREE.BufferGeometry();
    const pPositions = new Float32Array(pCount * 3);
    const pColors = new Float32Array(pCount * 3);
    
    const activeParticles = [];
    for (let p = 0; p < pCount; p++) {
      const curveObj = curves[Math.floor(Math.random() * curves.length)];
      const t = Math.random();
      const speed = 0.12 + Math.random() * 0.18;
      activeParticles.push({ curveObj, t, speed });
      
      const pos = curveObj.curve.getPointAt(t);
      pPositions[p*3] = pos.x;
      pPositions[p*3+1] = pos.y;
      pPositions[p*3+2] = pos.z;
      
      pColors[p*3] = curveObj.color.r;
      pColors[p*3+1] = curveObj.color.g;
      pColors[p*3+2] = curveObj.color.b;
    }
    
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));
    
    const pMat = new THREE.PointsMaterial({
      size: 4.5,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    
    const pPoints = new THREE.Points(pGeo, pMat);
    pPoints.renderOrder = 5;
    group.add(pPoints);
    
    // Store data for animation in tick
    group.userData.particles = activeParticles;
    group.userData.pPoints = pPoints;
  }

  return group;
}

function buildCyberpunkRings() {
  const group = new THREE.Group();
  group.userData.isCyberpunkRings = true;

  const ringSpecs = [
    { lat: 0, color: 0xff2eea, opacity: 0.5, width: 1.012 },
    { lat: 28, color: 0x00f5ff, opacity: 0.28, width: 1.018 },
    { lat: -32, color: 0x7c5cff, opacity: 0.3, width: 1.016 },
  ];

  for (const spec of ringSpecs) {
    const points = [];
    for (let lng = -180; lng <= 180; lng += 3) {
      points.push(lngLatToVec3(lng, spec.lat, spec.width));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: spec.color,
      transparent: true,
      opacity: spec.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.renderOrder = 3;
    group.add(line);
  }

  const wireGeo = new THREE.SphereGeometry(1.028, 24, 16);
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x00f5ff,
    wireframe: true,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const wire = new THREE.Mesh(wireGeo, wireMat);
  wire.renderOrder = 1;
  group.add(wire);

  // Scanner Laser Line
  const scannerPoints = [];
  for (let i = 0; i <= 96; i++) {
    const theta = (i / 96) * Math.PI * 2;
    scannerPoints.push(new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)));
  }
  const scannerGeo = new THREE.BufferGeometry().setFromPoints(scannerPoints);
  const scannerMat = new THREE.LineBasicMaterial({
    color: 0x00f5ff,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const scanner = new THREE.Line(scannerGeo, scannerMat);
  scanner.userData.isScanner = true;
  scanner.renderOrder = 4;
  group.add(scanner);

  return group;
}

function buildPlanetSurface(continents = [], outlinePx = 12, mode = 'surface') {
  return PlanetRenderRegistry.build(mode, continents, { outlinePx });
}

function buildStarfield() {
  const N = 1500;
  const positions = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const v = new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    ).normalize().multiplyScalar(50 + Math.random() * 30);
    positions[i*3] = v.x; positions[i*3+1] = v.y; positions[i*3+2] = v.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, sizeAttenuation: true });
  return new THREE.Points(geo, mat);
}

function buildCityMarkers(cities) {
  const group = new THREE.Group();
  group.userData.kind = 'cities';
  group.userData.items = [];
  for (const c of cities) {
    const pos = lngLatToVec3(c.lng, c.lat, R_CITY);
    const geo = new THREE.SphereGeometry(0.004, 12, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff5e3a });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.userData.city = c;
    group.add(mesh);
    group.userData.items.push({ city: c, mesh });
  }
  return group;
}

// Pre-allocated static scratch variables to avoid GC thrashing / memory allocations on tick frames
const _cameraDir = new THREE.Vector3();
const _anchorTemp = new THREE.Vector3();
const _normalTemp = new THREE.Vector3();

const _vOrb1 = new THREE.Vector3();
const _vOrb2 = new THREE.Vector3();
const _vOrbUp = new THREE.Vector3();
const _vOrbPos = new THREE.Vector3();
const _qOrb = new THREE.Quaternion();
const _vAxisZ = new THREE.Vector3(0, 0, 1);
const _vAxisY = new THREE.Vector3(0, 1, 0);

function orientToSurface(mesh, up) {
  mesh.quaternion.setFromUnitVectors(_vAxisY, up);
}

function buildMarkerMesh(marker, mode = 'surface', allMarkers = []) {
  const size = marker.size || 0.024;
  const height = marker.height || size * 2.8;
  const color = new THREE.Color(marker.color || '#ff5e3a');
  const alt = marker.isOrbital ? (marker.altitude || 1.18) : R_CITY;
  
  let up = lngLatToVec3(marker.lng, marker.lat, 1).normalize();
  let e1 = up.clone();
  let e2;

  if (marker.isOrbital && marker.orbitNodeA && marker.orbitNodeB) {
    const nodeAObj = allMarkers.find(m => m.id === marker.orbitNodeA);
    const nodeBObj = allMarkers.find(m => m.id === marker.orbitNodeB);
    if (nodeAObj && nodeBObj) {
      const uA = lngLatToVec3(nodeAObj.lng, nodeAObj.lat, 1).normalize();
      const uB = lngLatToVec3(nodeBObj.lng, nodeBObj.lat, 1).normalize();
      const cross = new THREE.Vector3().crossVectors(uA, uB);
      e1.copy(uA);
      if (cross.length() > 0.01) {
        const normal = cross.normalize();
        e2 = new THREE.Vector3().crossVectors(normal, e1).normalize();
      } else {
        const normal = new THREE.Vector3(0, 1, 0);
        e2 = new THREE.Vector3().crossVectors(normal, e1).normalize();
      }
      const startAngle = hash(marker.lat || 0, marker.lng || 0) * Math.PI * 2;
      up.copy(e1.clone().multiplyScalar(Math.cos(startAngle)).add(e2.clone().multiplyScalar(Math.sin(startAngle))).normalize());
    }
  }
  let mesh;

  if (mode === 'cyberpunk') {
    // High-tech holographic beacon
    const beamHeight = 0.18;
    const beamGeo = new THREE.CylinderGeometry(0.002, 0.008, beamHeight, 8, 1, true);
    beamGeo.translate(0, beamHeight / 2, 0);
    const beamMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    mesh = new THREE.Mesh(beamGeo, beamMat);
    mesh.position.copy(up.clone().multiplyScalar(alt));
    orientToSurface(mesh, up);
    mesh.userData.isCyberpunkBeacon = true;
    mesh.userData.baseHeight = beamHeight;
  } else {
    if (marker.shape === 'cube') {
      const geo = new THREE.BoxGeometry(size, size, size);
      const mat = new THREE.MeshBasicMaterial({ color });
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(up.clone().multiplyScalar(alt + size * 0.58));
      orientToSurface(mesh, up);
    } else if (marker.shape === 'bar') {
      const geo = new THREE.CylinderGeometry(size * 0.34, size * 0.44, height, 8);
      const mat = new THREE.MeshBasicMaterial({ color });
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(up.clone().multiplyScalar(alt + height * 0.5));
      orientToSurface(mesh, up);
    } else {
      const geo = new THREE.SphereGeometry(size, 18, 12);
      const mat = new THREE.MeshBasicMaterial({ color });
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(up.clone().multiplyScalar(alt + size * 1.15));
    }
  }

  const group = new THREE.Group();

  if (mode === 'cyberpunk') {
    const ring1Geo = new THREE.RingGeometry(size * 0.6, size * 0.9, 32);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.position.copy(up.clone().multiplyScalar(alt + 0.001));
    ring1.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
    ring1.userData.isPulsingRing = true;
    ring1.userData.pulseSpeed = 0.04;
    ring1.userData.maxScale = 2.2;
    group.add(ring1);

    const ring2Geo = new THREE.RingGeometry(size * 1.2, size * 1.3, 32);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.position.copy(up.clone().multiplyScalar(alt + 0.0015));
    ring2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
    ring2.userData.isRotatingRing = true;
    ring2.userData.rotSpeed = 0.02;
    group.add(ring2);
  } else {
    const haloGeo = new THREE.RingGeometry(size * 1.35, size * 1.75, 24);
    const haloMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.copy(up.clone().multiplyScalar(alt + 0.001));
    halo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
    halo.userData.isHalo = true;
    group.add(halo);
  }

  group.add(mesh);
  group.userData.marker = marker;

  if (marker.isOrbital) {
    group.userData.isOrbital = true;
    group.userData.orbitLat = marker.lat;
    group.userData.orbitLngStart = marker.lng;
    group.userData.orbitAngle = hash(marker.lat, marker.lng) * Math.PI * 2;
    group.userData.orbitSpeed = 0.004 + hash(marker.lng, marker.lat) * 0.004;
    group.userData.altitude = alt;
    if (e1 && e2) {
      group.userData.orbitE1 = e1;
      group.userData.orbitE2 = e2;
    }
  }

  const labelHeight = mode === 'cyberpunk' ? 0.20 : Math.max(size * 2.2, height + 0.018);
  group.userData.labelHeight = labelHeight;
  group.userData.anchor = up.clone().multiplyScalar(alt + labelHeight);
  group.renderOrder = 5;
  return group;
}

function buildMarkers(markers = [], mode = 'surface') {
  const group = new THREE.Group();
  group.userData.kind = 'markers';
  group.userData.items = [];

  for (const marker of markers) {
    if (!Number.isFinite(marker.lng) || !Number.isFinite(marker.lat)) continue;
    const item = buildMarkerMesh(marker, mode, markers);
    group.add(item);
    group.userData.items.push(item);

    if (marker.isOrbital) {
      const alt = marker.altitude || 1.18;
      const nodeA = markers.find(m => m.id === marker.orbitNodeA);
      const nodeB = markers.find(m => m.id === marker.orbitNodeB);
      if (nodeA && nodeB) {
        const uA = lngLatToVec3(nodeA.lng, nodeA.lat, 1).normalize();
        const uB = lngLatToVec3(nodeB.lng, nodeB.lat, 1).normalize();
        const cross = new THREE.Vector3().crossVectors(uA, uB);
        let e1 = uA.clone();
        let e2;
        if (cross.length() > 0.01) {
          const normal = cross.normalize();
          e2 = new THREE.Vector3().crossVectors(normal, e1).normalize();
        } else {
          const normal = new THREE.Vector3(0, 1, 0);
          e2 = new THREE.Vector3().crossVectors(normal, e1).normalize();
        }

        const points = [];
        for (let step = 0; step <= 120; step++) {
          const theta = (step / 120) * Math.PI * 2;
          const p = e1.clone().multiplyScalar(Math.cos(theta))
                      .add(e2.clone().multiplyScalar(Math.sin(theta)))
                      .multiplyScalar(alt);
          points.push(p);
        }
        const ringGeo = new THREE.BufferGeometry().setFromPoints(points);
        const ringMat = new THREE.LineBasicMaterial({
          color: new THREE.Color(marker.color || '#ff5e3a'),
          transparent: true,
          opacity: mode === 'cyberpunk' ? 0.48 : mode === 'hybrid' ? 0.38 : 0.28,
          blending: (mode === 'cyberpunk' || mode === 'hybrid') ? THREE.AdditiveBlending : THREE.NormalBlending,
          depthWrite: false
        });
        const ringLine = new THREE.Line(ringGeo, ringMat);
        ringLine.renderOrder = 2;
        group.add(ringLine);
      }
    }
  }

  const linksEnabled = window.GlobeController ? window.GlobeController.getState().linksEnabled : true;
  if (linksEnabled && markers.length >= 2) {
    const curves = [];
    for (let i = 0; i < markers.length - 1; i++) {
      const a = markers[i];
      const b = markers[i + 1];
      if (!Number.isFinite(a.lng) || !Number.isFinite(a.lat) || !Number.isFinite(b.lng) || !Number.isFinite(b.lat)) continue;

      const start = lngLatToVec3(a.lng, a.lat, 1.012);
      const end = lngLatToVec3(b.lng, b.lat, 1.012);
      const dist = start.distanceTo(end);
      const mid = start.clone().add(end).normalize().multiplyScalar(1.05 + dist * 0.18);
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      curves.push({
        curve,
        color: new THREE.Color(a.color || '#ff5e3a')
      });

      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(48));
      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color(a.color || '#ff5e3a'),
        transparent: true,
        opacity: mode === 'cyberpunk' ? 0.65 : mode === 'hybrid' ? 0.55 : 0.45,
        blending: (mode === 'cyberpunk' || mode === 'hybrid') ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      line.renderOrder = 3;
      group.add(line);
    }

    if (curves.length > 0 && (mode === 'cyberpunk' || mode === 'hybrid')) {
      const pCount = curves.length * 4;
      const pGeo = new THREE.BufferGeometry();
      const pPositions = new Float32Array(pCount * 3);
      const pColors = new Float32Array(pCount * 3);

      const activeParticles = [];
      for (let p = 0; p < pCount; p++) {
        const curveObj = curves[Math.floor(p / 4)];
        const t = (p % 4) / 4 + Math.random() * 0.1;
        const speed = 0.08 + Math.random() * 0.08;
        activeParticles.push({ curveObj, t, speed });

        const pos = curveObj.curve.getPointAt(t % 1.0);
        pPositions[p * 3] = pos.x;
        pPositions[p * 3 + 1] = pos.y;
        pPositions[p * 3 + 2] = pos.z;

        pColors[p * 3] = curveObj.color.r;
        pColors[p * 3 + 1] = curveObj.color.g;
        pColors[p * 3 + 2] = curveObj.color.b;
      }

      pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
      pGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));

      const pMat = new THREE.PointsMaterial({
        size: mode === 'cyberpunk' ? 5.5 : 4.0,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const pPoints = new THREE.Points(pGeo, pMat);
      pPoints.renderOrder = 4;
      group.add(pPoints);

      group.userData.particles = activeParticles;
      group.userData.pPoints = pPoints;
    }
  }

  return group;
}

function projectMarkerLabels(markerGroup, camera, canvas) {
  if (!markerGroup) return [];
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  
  _cameraDir.copy(camera.position).normalize();
  const labels = [];

  for (const item of markerGroup.userData.items || []) {
    const marker = item.userData.marker;
    if (!item.userData.anchor) continue;

    _anchorTemp.copy(item.userData.anchor);
    _normalTemp.copy(_anchorTemp).normalize();
    _anchorTemp.project(camera);

    const visible =
      _normalTemp.dot(_cameraDir) > -0.08 &&
      _anchorTemp.z > -1 &&
      _anchorTemp.z < 1 &&
      _anchorTemp.x >= -1.15 &&
      _anchorTemp.x <= 1.15 &&
      _anchorTemp.y >= -1.15 &&
      _anchorTemp.y <= 1.15;

    labels.push({
      id: marker.id || marker.label || `${marker.lng},${marker.lat}`,
      label: marker.label || marker.id || 'Marker',
      color: marker.color || '#ff5e3a',
      x: (_anchorTemp.x * 0.5 + 0.5) * w,
      y: (-_anchorTemp.y * 0.5 + 0.5) * h,
      visible,
    });
  }
  return labels;
}

// Pseudo-random — stable per (lat,lng) seed
function hash(x, y) {
  let h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return h - Math.floor(h);
}


// 1. Solid Mode (classic cartoon surface)
PlanetRenderRegistry.register({
  id: 'surface',
  label: 'Solid',
  build(continents, options = {}) {
    const group = new THREE.Group();
    const outlinePx = options.outlinePx || 12;
    const canvas = buildMapCanvas(continents, { outlinePx });
    group.add(buildTextureSphere(canvas, R_OCEAN));
    return group;
  },
  getAtmosphereColor() {
    return new THREE.Color(0.45, 0.7, 1.0);
  },
  getMarkerMode() {
    return 'surface';
  }
});

// 2. Dotted Mode (simple dotted grid)
PlanetRenderRegistry.register({
  id: 'dots',
  label: 'Dots',
  build(continents, options = {}) {
    const group = new THREE.Group();
    const baseCanvas = buildMapCanvas(continents, {
      landColor: '#14371f',
      oceanColor: '#06142a',
      drawOutline: false,
    });
    group.add(buildTextureSphere(baseCanvas, R_OCEAN, { opacity: 0.58, transparent: true }));
    group.add(buildDotCloud(continents, 'dots'));
    return group;
  },
  getAtmosphereColor() {
    return new THREE.Color(0.45, 0.7, 1.0);
  },
  getMarkerMode() {
    return 'surface';
  }
});

// 3. Hybrid Mode (dotted grid with dynamic networking connections)
PlanetRenderRegistry.register({
  id: 'hybrid',
  label: 'Hybrid',
  build(continents, options = {}) {
    const group = new THREE.Group();
    const baseCanvas = buildMapCanvas(continents, {
      landColor: '#111a2f',
      oceanColor: '#030814',
      drawOutline: false,
    });
    group.add(buildTextureSphere(baseCanvas, R_OCEAN, {
      color: 0x7c5cff,
      opacity: 0.52,
      transparent: true,
    }));
    const dots = buildDotCloud(continents, 'hybrid');
    group.add(dots);
    group.add(buildHybridArcs(dots.userData.landPoints || []));
    return group;
  },
  getAtmosphereColor() {
    return new THREE.Color('#7c5cff');
  },
  getMarkerMode() {
    return 'surface';
  }
});

// 4. Cyberpunk Mode (outstanding high-tech holographic simulation)
PlanetRenderRegistry.register({
  id: 'cyberpunk',
  label: 'Cyber',
  build(continents, options = {}) {
    const group = new THREE.Group();
    const baseCanvas = buildMapCanvas(continents, {
      landColor: '#0c001c',
      oceanColor: '#020008',
      drawOutline: true,
      outlineColor: '#00ffff',
      outlinePx: 12,
      landGrid: true,
    });
    group.add(buildTextureSphere(baseCanvas, R_OCEAN, {
      color: 0xffffff,
      opacity: 0.8,
      transparent: true,
    }));
    const dots = buildDotCloud(continents, 'cyberpunk');
    group.add(buildCyberpunkRings());
    group.add(dots);
    group.add(buildCyberpunkArcs(dots.userData.landPoints || []));
    return group;
  },
  getAtmosphereColor() {
    return new THREE.Color('#ff00b0');
  },
  getMarkerMode() {
    return 'cyberpunk';
  },
  animate(group, context) {
    // Rotate wireframe sphere and scan laser
    group.traverse(child => {
      if (child.userData && child.userData.isCyberpunkRings) {
        child.traverse(sub => {
          if (sub.isMesh && sub.material.wireframe) {
            sub.rotation.y += 0.0015;
            sub.rotation.x += 0.0006;
          }
          if (sub.userData && sub.userData.isScanner) {
            const time = performance.now() * 0.0012;
            const y = Math.sin(time) * 1.02;
            sub.position.y = y;
            const R = 1.03;
            const r = Math.sqrt(Math.max(0.01, R * R - y * y));
            sub.scale.set(r, 1, r);
          }
        });
      }
      
      // Animate flying data packets along network arcs
      if (child.userData && child.userData.particles && child.userData.pPoints) {
        const particles = child.userData.particles;
        const pPoints = child.userData.pPoints;
        const posAttr = pPoints.geometry.getAttribute('position');
        for (let p = 0; p < particles.length; p++) {
          const pt = particles[p];
          pt.t += pt.speed * 0.014;
          if (pt.t > 1) pt.t = 0;
          const pos = pt.curveObj.curve.getPointAt(pt.t);
          posAttr.setXYZ(p, pos.x, pos.y, pos.z);
        }
        posAttr.needsUpdate = true;
      }
    });
  }
});

// Procedural ground patch around a focus point. Builds a flat-ish quilt of
// land tiles, roads, trees and buildings tangent to the sphere.
function buildGroundPatch(focusLng, focusLat) {
  const group = new THREE.Group();
  const frame = tangentFrame(focusLng, focusLat, R_DETAIL);
  const { center, up, east, north } = frame;

  // Patch is ~2 km square — we place it as flat tangent geometry; at this
  // zoom the curvature of Earth across 2km is < 0.16 m, invisible.
  const halfSize_m = 1500;
  const halfSize   = halfSize_m / EARTH_RADIUS_M;

  // helpers to place tangent points on the sphere surface
  const place = (e, n, lift = 0) =>
    center.clone()
      .addScaledVector(east, e)
      .addScaledVector(north, n)
      .addScaledVector(up, lift)
      .normalize()
      .multiplyScalar(R_DETAIL + lift);

  // --- Ground tiles (grass + dirt) ----------------------------------------
  const tileN     = 24;
  const tileSize  = (2 * halfSize) / tileN;
  const tilePositions = [];
  const tileColors    = [];
  const tileIndices   = [];
  let vIdx = 0;
  const grass1 = new THREE.Color('#b6d57a');
  const grass2 = new THREE.Color('#a3c66a');
  const dirt   = new THREE.Color('#caa771');
  const path   = new THREE.Color('#d9c598');

  for (let iy = 0; iy < tileN; iy++) {
    for (let ix = 0; ix < tileN; ix++) {
      const e0 = -halfSize + ix * tileSize;
      const n0 = -halfSize + iy * tileSize;
      const e1 = e0 + tileSize;
      const n1 = n0 + tileSize;

      const h = hash(ix + focusLng * 71, iy + focusLat * 53);
      let col = grass1.clone().lerp(grass2, h);
      if (h > 0.85) col = dirt;
      if (h > 0.97) col = path;

      const corners = [
        place(e0, n0), place(e1, n0), place(e1, n1), place(e0, n1)
      ];
      for (const v of corners) {
        tilePositions.push(v.x, v.y, v.z);
        tileColors.push(col.r, col.g, col.b);
      }
      tileIndices.push(vIdx, vIdx+1, vIdx+2, vIdx, vIdx+2, vIdx+3);
      vIdx += 4;
    }
  }
  {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(tilePositions, 3));
    g.setAttribute('color',    new THREE.Float32BufferAttribute(tileColors, 3));
    g.setIndex(tileIndices);
    const m = new THREE.MeshBasicMaterial({ vertexColors: true });
    group.add(new THREE.Mesh(g, m));
  }

  // --- Roads (grid streets) ------------------------------------------------
  const roadColor = new THREE.Color('#2f2f33');
  const roadW_m   = 8;
  const roadW     = roadW_m / EARTH_RADIUS_M;
  const blocks    = 8;
  const blockStep = (2 * halfSize) / blocks;
  const roadGroup = new THREE.Group();

  function quad(corners, color) {
    const positions = [];
    for (const v of corners) positions.push(v.x, v.y, v.z);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex([0,1,2, 0,2,3]);
    const m = new THREE.MeshBasicMaterial({ color });
    return new THREE.Mesh(g, m);
  }

  // East-west roads
  for (let i = 0; i <= blocks; i++) {
    const n = -halfSize + i * blockStep;
    const lift = 0.5 / EARTH_RADIUS_M;
    roadGroup.add(quad([
      place(-halfSize, n - roadW/2, lift),
      place( halfSize, n - roadW/2, lift),
      place( halfSize, n + roadW/2, lift),
      place(-halfSize, n + roadW/2, lift),
    ], roadColor));
  }
  // North-south roads
  for (let i = 0; i <= blocks; i++) {
    const e = -halfSize + i * blockStep;
    const lift = 0.5 / EARTH_RADIUS_M;
    roadGroup.add(quad([
      place(e - roadW/2, -halfSize, lift),
      place(e + roadW/2, -halfSize, lift),
      place(e + roadW/2,  halfSize, lift),
      place(e - roadW/2,  halfSize, lift),
    ], roadColor));
  }
  group.add(roadGroup);

  // --- Buildings -----------------------------------------------------------
  const buildingsGroup = new THREE.Group();
  const buildingColors = ['#e8d8b8', '#d4b88a', '#c89c70', '#bcd0c5', '#a8b8c9', '#e3b8a0'];

  // Build instanced cuboids — we'll just place many BoxGeometry meshes
  // because the count is moderate (~hundreds).
  for (let bx = 0; bx < blocks; bx++) {
    for (let by = 0; by < blocks; by++) {
      const e0 = -halfSize + bx * blockStep + roadW;
      const n0 = -halfSize + by * blockStep + roadW;
      const innerSize = blockStep - 2 * roadW;
      // each block has a grid of plots
      const plotN = 3;
      const plotSize = innerSize / plotN;
      for (let pi = 0; pi < plotN; pi++) {
        for (let pj = 0; pj < plotN; pj++) {
          const seed = hash(bx * 13 + pi + focusLng * 17, by * 7 + pj + focusLat * 31);
          if (seed < 0.18) continue; // empty lot
          const isPark = seed > 0.93;
          const e = e0 + pi * plotSize + plotSize/2;
          const n = n0 + pj * plotSize + plotSize/2;
          const margin = plotSize * 0.18;
          const w = plotSize - margin*2;
          const d = plotSize - margin*2;
          const w_m = w * EARTH_RADIUS_M;
          const d_m = d * EARTH_RADIUS_M;

          if (isPark) {
            // place a few trees
            for (let t = 0; t < 4; t++) {
              const trSeed = hash(seed*100 + t, bx + by);
              const te = e + (trSeed - 0.5) * w * 0.7;
              const tn = n + (hash(trSeed, t) - 0.5) * d * 0.7;
              const trunk_h_m = 4;
              const canopy_r_m = 5;
              const trunkG = new THREE.CylinderGeometry(
                0.6 / EARTH_RADIUS_M, 0.8 / EARTH_RADIUS_M,
                trunk_h_m / EARTH_RADIUS_M, 6
              );
              const trunk = new THREE.Mesh(trunkG, new THREE.MeshBasicMaterial({ color: 0x6b4a2a }));
              const trunkPos = place(te, tn, (trunk_h_m/2) / EARTH_RADIUS_M);
              trunk.position.copy(trunkPos);
              trunk.lookAt(0,0,0); trunk.rotateX(Math.PI/2);
              buildingsGroup.add(trunk);

              const canopyG = new THREE.SphereGeometry(canopy_r_m / EARTH_RADIUS_M, 8, 6);
              const canopy  = new THREE.Mesh(canopyG, new THREE.MeshBasicMaterial({ color: 0x4f8a3d }));
              const canopyPos = place(te, tn, (trunk_h_m + canopy_r_m*0.4) / EARTH_RADIUS_M);
              canopy.position.copy(canopyPos);
              buildingsGroup.add(canopy);
            }
            continue;
          }

          const h_m = 6 + seed * 90;       // 6 – 96m tall
          const h   = h_m / EARTH_RADIUS_M;
          const col = buildingColors[Math.floor(hash(seed, bx+by) * buildingColors.length)];
          const boxG = new THREE.BoxGeometry(w, h, d);
          const boxM = new THREE.MeshBasicMaterial({ color: col });
          const box  = new THREE.Mesh(boxG, boxM);
          const pos  = place(e, n, h/2);
          box.position.copy(pos);

          // orient box: y-axis -> up, x-axis -> east, z-axis -> north
          const matrix = new THREE.Matrix4();
          matrix.makeBasis(east.clone(), up.clone(), north.clone().negate());
          box.quaternion.setFromRotationMatrix(matrix);

          // dark outline using an EdgesGeometry
          const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(boxG),
            new THREE.LineBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.55 })
          );
          edges.position.copy(box.position);
          edges.quaternion.copy(box.quaternion);

          buildingsGroup.add(box);
          buildingsGroup.add(edges);
        }
      }
    }
  }
  group.add(buildingsGroup);

  group.userData.focus = { lng: focusLng, lat: focusLat };
  return group;
}

// =============================================================================
// Camera controller — orbits a focus point with altitude-based pan speed.
// =============================================================================
class GlobeControls {
  constructor(camera, dom, onChange) {
    this.camera = camera;
    this.dom    = dom;
    this.onChange = onChange;

    // spherical coords for camera (relative to scene origin = planet center)
    this.radius = 3.2;
    this.theta  = Math.PI;            // looking at lng=0 (Africa) initially
    this.phi    = Math.PI * 0.42;
    this.targetRadius = this.radius;
    this.targetTheta  = this.theta;
    this.targetPhi    = this.phi;

    this._dragging = false;
    this._lastX = 0; this._lastY = 0;

    dom.addEventListener('pointerdown', this._onDown);
    dom.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    dom.addEventListener('wheel', this._onWheel, { passive: false });
    this._update(true);
  }

  _onDown = (e) => {
    this._dragging = true;
    this._lastX = e.clientX; this._lastY = e.clientY;
    this.dom.setPointerCapture(e.pointerId);
  };

  _onUp = (e) => {
    this._dragging = false;
    try { this.dom.releasePointerCapture(e.pointerId); } catch {}
  };

  _onMove = (e) => {
    if (!this._dragging) return;
    const dx = e.clientX - this._lastX;
    const dy = e.clientY - this._lastY;
    this._lastX = e.clientX; this._lastY = e.clientY;

    // panning sensitivity scales with altitude — slower when close
    const alt = Math.max(0.00001, this.targetRadius - 1);
    const speed = alt * 0.0028;
    this.targetTheta -= dx * speed;
    this.targetPhi   -= dy * speed;
    this.targetPhi   = Math.max(0.05, Math.min(Math.PI - 0.05, this.targetPhi));
  };

  _onWheel = (e) => {
    e.preventDefault();
    // exponential zoom — smooth across 9 orders of magnitude
    const factor = Math.exp(e.deltaY * 0.0015);
    this.targetRadius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, this.targetRadius * factor));
  };

  setRadius(r) { this.targetRadius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, r)); }

  jumpTo(lng, lat, radius) {
    this.radius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, radius));
    this.theta  = (lng + 180) * Math.PI / 180;
    this.phi    = (90 - lat) * Math.PI / 180;
    this.targetRadius = this.radius;
    this.targetTheta  = this.theta;
    this.targetPhi    = this.phi;
    this._anim = null;
    this._update(true);
  }

  flyTo(lng, lat, radius, duration = 1500) {
    const phi   = (90 - lat) * Math.PI / 180;
    const theta = (lng + 180) * Math.PI / 180;
    this._anim = {
      t0: performance.now(),
      duration,
      from: { r: this.targetRadius, t: this.targetTheta, p: this.targetPhi },
      to:   { r: radius, t: theta, p: phi },
    };
  }

  tick() {
    if (this._anim) {
      const t = Math.min(1, (performance.now() - this._anim.t0) / this._anim.duration);
      const k = 1 - Math.pow(1 - t, 3);
      const { from, to } = this._anim;
      // interp radius in log space so altitude feels even
      const lr = Math.log(from.r) + (Math.log(to.r) - Math.log(from.r)) * k;
      this.targetRadius = Math.exp(lr);
      this.targetTheta  = from.t + (to.t - from.t) * k;
      this.targetPhi    = from.p + (to.p - from.p) * k;
      if (t >= 1) this._anim = null;
    }
    this._update(false);
  }

  _update(snap) {
    const a = snap ? 1 : 0.18;
    this.radius += (this.targetRadius - this.radius) * a;
    this.theta  += (this.targetTheta  - this.theta)  * a;
    this.phi    += (this.targetPhi    - this.phi)    * a;

    // Match the lng/lat→vec3 convention so flyTo(lng,lat) lands above the
    // correct surface point: x = -r·sin(phi)·cos(theta), z = r·sin(phi)·sin(theta)
    const x = -this.radius * Math.sin(this.phi) * Math.cos(this.theta);
    const y =  this.radius * Math.cos(this.phi);
    const z =  this.radius * Math.sin(this.phi) * Math.sin(this.theta);
    this.camera.position.set(x, y, z);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);

    const alt = Math.max(1e-7, this.radius - 1);
    this.camera.near = Math.max(1e-7, alt * 0.001);
    this.camera.far  = 200;
    this.camera.updateProjectionMatrix();

    if (this.onChange) this.onChange(this);
  }
}

// =============================================================================
// Modular Floating Controls Components
// =============================================================================
function AltitudeCoordinatesHUD({ hud }) {
  return (
    <div className="hud hud-tl">
      <div className="hud-row">
        <span className="hud-label">ALT</span>
        <span className="hud-value">{hud.scaleLabel}</span>
      </div>
      <div className="hud-row">
        <span className="hud-label">LAT</span>
        <span className="hud-value">{hud.focusLat.toFixed(3)}°</span>
      </div>
      <div className="hud-row">
        <span className="hud-label">LNG</span>
        <span className="hud-value">{hud.focusLng.toFixed(3)}°</span>
      </div>
    </div>
  );
}

function ScaleBarHUD({ hud }) {
  return (
    <div className="scalebar">
      <div className="scalebar-track" style={{ width: hud.scaleBarPx }}>
        <div className="scalebar-tick" />
        <div className="scalebar-tick scalebar-tick-r" />
      </div>
      <div className="scalebar-label">{hud.scaleBarLabel}</div>
    </div>
  );
}

function StartLevelControl({ startView, setInitialView }) {
  return (
    <div className="panel">
      <div className="panel-title">Start level</div>
      <div className="segmented" role="group" aria-label="Initial start level">
        <button
          type="button"
          className={startView === 'globe' ? 'is-active' : ''}
          aria-pressed={startView === 'globe'}
          onClick={() => setInitialView('globe')}
        >
          Globe
        </button>
        <button
          type="button"
          className={startView === 'ground' ? 'is-active' : ''}
          aria-pressed={startView === 'ground'}
          onClick={() => setInitialView('ground')}
        >
          Ground
        </button>
      </div>
    </div>
  );
}

function RenderModeControl({ renderMode, selectRenderMode }) {
  return (
    <div className="panel">
      <div className="panel-title">Render mode</div>
      <div className="segmented" role="group" aria-label="Render mode">
        {PlanetRenderRegistry.getAll().map(mode => (
          <button
            key={mode.id}
            type="button"
            className={renderMode === mode.id ? 'is-active' : ''}
            aria-pressed={renderMode === mode.id}
            onClick={() => selectRenderMode(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuickJumpControl({ flyTo }) {
  return (
    <div className="panel">
      <div className="panel-title">Quick jump</div>
      <button onClick={() => flyTo(0, 20, 6_000_000)}>🌍 Whole planet</button>
      <button onClick={() => flyTo(-100, 40, 3_500_000)}>North America</button>
      <button onClick={() => flyTo(-60, -15, 3_500_000)}>South America</button>
      <button onClick={() => flyTo(20, 5, 3_500_000)}>Africa</button>
      <button onClick={() => flyTo(15, 50, 2_500_000)}>Europe</button>
      <button onClick={() => flyTo(100, 30, 4_500_000)}>Asia</button>
      <button onClick={() => flyTo(135, -25, 3_000_000)}>Oceania</button>
      <button onClick={() => flyTo(0, -89, 4_000_000)}>Antarctica</button>
    </div>
  );
}

function MarkerManager({ markers, setMarkers, flyTo, placingMode, setPlacingMode, stateRef, linksEnabled }) {
  const [editorData, setEditorData] = useState(null); // { lat, lng } when form is open
  const [label, setLabel] = useState('');
  const [shape, setShape] = useState('orb');
  const [color, setColor] = useState('#ff5e3a');
  const [size, setSize] = useState(0.024);
  const [isOrbital, setIsOrbital] = useState(false);
  const [orbitAlt, setOrbitAlt] = useState(1.18);
  const [nodeA, setNodeA] = useState('');
  const [nodeB, setNodeB] = useState('');

  const colorPresets = [
    { value: '#ff2eea', label: 'Magenta' },
    { value: '#00f5ff', label: 'Cyan' },
    { value: '#39ffd7', label: 'Lime' },
    { value: '#ffe600', label: 'Yellow' },
    { value: '#7c5cff', label: 'Purple' },
    { value: '#ff5e3a', label: 'Coral' }
  ];

  useEffect(() => {
    stateRef.current.onGlobeClick = (lng, lat) => {
      setEditorData({ lat, lng });
      setLabel(`Marker at ${lat.toFixed(1)}°, ${lng.toFixed(1)}°`);
      setPlacingMode(false);
      setSize(0.024);
      setIsOrbital(false);
      setOrbitAlt(1.18);
      const availableNodes = markers.filter(m => !m.isOrbital);
      if (availableNodes.length >= 2) {
        setNodeA(availableNodes[0].id);
        setNodeB(availableNodes[1].id);
      } else {
        setNodeA('');
        setNodeB('');
      }
    };
    return () => {
      stateRef.current.onGlobeClick = null;
    };
  }, [stateRef, setPlacingMode, markers]);

  function handleAddClick() {
    setEditorData(null);
    setPlacingMode(true);
  }

  function handleCancelPlacing() {
    setPlacingMode(false);
  }

  function handleSave() {
    if (!editorData) return;
    const newMarker = {
      id: 'custom_' + Date.now(),
      label: label.trim() || `Marker at ${editorData.lat.toFixed(1)}°, ${editorData.lng.toFixed(1)}°`,
      lng: editorData.lng,
      lat: editorData.lat,
      shape: shape,
      color: color,
      size: Number(size),
      isOrbital: isOrbital,
      altitude: isOrbital ? Number(orbitAlt) : 1.0,
      orbitNodeA: isOrbital ? nodeA : '',
      orbitNodeB: isOrbital ? nodeB : ''
    };
    setMarkers([...markers, newMarker]);
    setEditorData(null);
  }

  function handleDelete(id) {
    setMarkers(markers.filter(m => m.id !== id));
  }

  return (
    <div className="panel">
      <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <span>Markers</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 10, textTransform: 'none', color: 'var(--hud-fg)', fontWeight: 'normal' }}>
          <input 
            type="checkbox" 
            checked={!!linksEnabled} 
            onChange={e => window.GlobeController.setLinksEnabled(e.target.checked)} 
            style={{ accentColor: 'var(--accent)', cursor: 'pointer', margin: 0 }}
          />
          Link
        </label>
      </div>
      
      {!placingMode && !editorData && (
        <button 
          onClick={handleAddClick} 
          style={{ width: '100%', textAlign: 'center', marginBottom: 8, background: 'rgba(255, 94, 58, 0.12)', borderColor: 'var(--accent)' }}
        >
          ➕ Add Custom Marker
        </button>
      )}

      {placingMode && (
        <button 
          onClick={handleCancelPlacing} 
          style={{ width: '100%', textAlign: 'center', marginBottom: 8, background: 'rgba(255, 94, 58, 0.06)', borderColor: 'var(--hud-dim)' }}
        >
          🚫 Cancel Placement
        </button>
      )}

      {editorData && (
        <div className="marker-editor-card">
          <div className="marker-editor-title">Configure Marker</div>
          <div className="marker-editor-row">
            <input 
              type="text" 
              className="marker-editor-input"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Marker Label"
            />
          </div>
          
          <div className="marker-editor-row">
            <div className="marker-editor-title" style={{ fontSize: 9 }}>Shape</div>
            <div className="segmented" style={{ padding: 2, marginBottom: 0 }}>
              <button 
                type="button" 
                className={shape === 'orb' ? 'is-active' : ''} 
                onClick={() => setShape('orb')}
                style={{ padding: '3px 4px', fontSize: 10, textAlign: 'center' }}
              >
                Orb
              </button>
              <button 
                type="button" 
                className={shape === 'cube' ? 'is-active' : ''} 
                onClick={() => setShape('cube')}
                style={{ padding: '3px 4px', fontSize: 10, textAlign: 'center' }}
              >
                Cube
              </button>
              <button 
                type="button" 
                className={shape === 'bar' ? 'is-active' : ''} 
                onClick={() => setShape('bar')}
                style={{ padding: '3px 4px', fontSize: 10, textAlign: 'center' }}
              >
                Bar
              </button>
            </div>
          </div>

          <div className="marker-editor-row">
            <div className="marker-editor-title" style={{ fontSize: 9 }}>Color</div>
            <div className="marker-editor-colors">
              {colorPresets.map(preset => (
                <button
                  key={preset.value}
                  type="button"
                  className={`color-swatch-btn ${color === preset.value ? 'is-active' : ''}`}
                  style={{ background: preset.value }}
                  onClick={() => setColor(preset.value)}
                  title={preset.label}
                />
              ))}
            </div>
          </div>

          <div className="marker-editor-row">
            <div className="marker-editor-title" style={{ fontSize: 9, display: 'flex', justifyContent: 'space-between' }}>
              <span>Size</span>
              <span>{(size * 1000).toFixed(0)} units</span>
            </div>
            <input 
              type="range" 
              min="0.01" 
              max="0.05" 
              step="0.002"
              value={size}
              onChange={e => setSize(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', margin: '4px 0' }}
            />
          </div>

          <div className="marker-editor-row">
            <div className="marker-editor-title" style={{ fontSize: 9 }}>Placement</div>
            {markers.filter(m => !m.isOrbital).length >= 2 ? (
              <div className="segmented" style={{ padding: 2, marginBottom: 0 }}>
                <button 
                  type="button" 
                  className={!isOrbital ? 'is-active' : ''} 
                  onClick={() => setIsOrbital(false)}
                  style={{ padding: '3px 4px', fontSize: 10, textAlign: 'center' }}
                >
                  Surface
                </button>
                <button 
                  type="button" 
                  className={isOrbital ? 'is-active' : ''} 
                  onClick={() => {
                    setIsOrbital(true);
                    const av = markers.filter(m => !m.isOrbital);
                    if (av.length >= 2 && (!nodeA || !nodeB)) {
                      setNodeA(av[0].id);
                      setNodeB(av[1].id);
                    }
                  }}
                  style={{ padding: '3px 4px', fontSize: 10, textAlign: 'center' }}
                >
                  Orbit
                </button>
              </div>
            ) : (
              <div style={{ color: 'var(--hud-dim)', fontSize: 9, fontStyle: 'italic', lineHeight: '1.2', marginTop: 2 }}>
                ⚠️ Orbit placement requires at least 2 existing surface markers to define the orbital plane.
              </div>
            )}
          </div>

          {isOrbital && markers.filter(m => !m.isOrbital).length >= 2 && (
            <>
              <div className="marker-editor-row" style={{ display: 'flex', flexDirection: 'row', gap: 6 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="marker-editor-title" style={{ fontSize: 8 }}>Orbit Node A</span>
                  <select 
                    value={nodeA} 
                    onChange={e => setNodeA(e.target.value)} 
                    style={{ 
                      background: 'rgba(0,0,0,0.3)', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      borderRadius: 4, 
                      color: 'var(--hud-fg)', 
                      fontSize: 10, 
                      padding: '3px 4px',
                      outline: 'none',
                      cursor: 'pointer',
                      width: '100%'
                    }}
                  >
                    {markers.filter(m => !m.isOrbital).map(m => (
                      <option key={m.id} value={m.id} style={{ background: '#0a0e1a', color: '#fff' }}>{m.label}</option>
                    ))}
                  </select>
                </div>
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="marker-editor-title" style={{ fontSize: 8 }}>Orbit Node B</span>
                  <select 
                    value={nodeB} 
                    onChange={e => setNodeB(e.target.value)} 
                    style={{ 
                      background: 'rgba(0,0,0,0.3)', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      borderRadius: 4, 
                      color: 'var(--hud-fg)', 
                      fontSize: 10, 
                      padding: '3px 4px',
                      outline: 'none',
                      cursor: 'pointer',
                      width: '100%'
                    }}
                  >
                    {markers.filter(m => !m.isOrbital).map(m => (
                      <option key={m.id} value={m.id} style={{ background: '#0a0e1a', color: '#fff' }}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {nodeA === nodeB && (
                <div style={{ color: 'var(--accent)', fontSize: 9, fontStyle: 'italic', marginTop: -2 }}>
                  💡 Select 2 different nodes for a tilted orbit; same nodes use a flat equator orbit.
                </div>
              )}

              <div className="marker-editor-row">
                <div className="marker-editor-title" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
                  <span>Orbit Altitude</span>
                  <span>{((orbitAlt - 1.0) * 6371).toFixed(0)} km</span>
                </div>
                <input 
                  type="range" 
                  min="1.08" 
                  max="1.35" 
                  step="0.01"
                  value={orbitAlt}
                  onChange={e => setOrbitAlt(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', margin: '4px 0' }}
                />
              </div>
            </>
          )}

          <div className="marker-editor-actions">
            <button className="marker-item-btn marker-editor-btn" onClick={() => setEditorData(null)}>Cancel</button>
            <button className="marker-item-btn marker-editor-btn marker-editor-btn-save" onClick={handleSave}>Save</button>
          </div>
        </div>
      )}

      {markers.length > 0 && (
        <div className="marker-list">
          {markers.map(m => (
            <div key={m.id} className="marker-item">
              <div className="marker-item-info">
                <span className="marker-swatch" style={{ background: m.color, color: m.color, width: 6, height: 6 }} />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span className="marker-item-text" title={m.label}>{m.label}</span>
                  <span className="marker-item-coords">{m.lat.toFixed(1)}°, {m.lng.toFixed(1)}°</span>
                </div>
              </div>
              <div className="marker-item-actions">
                <button className="marker-item-btn" onClick={() => flyTo(m.lng, m.lat, 1500)}>Fly</button>
                <button className="marker-item-btn marker-item-btn-delete" onClick={() => handleDelete(m.id)}>Del</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main React component
// =============================================================================
function App() {
  const mountRef = useRef(null);
  const stateRef = globeStateRef;

  const [globeState, setGlobeState] = useState(() => window.GlobeController.getState());

  useEffect(() => {
    return window.GlobeController.subscribe(newState => {
      setGlobeState(newState);
    });
  }, []);

  const { renderMode, startView, markers, placingMode, hud, markerLabels, linksEnabled } = globeState;

  useEffect(() => {
    stateRef.current.isPlacingMode = placingMode;
  }, [placingMode]);

  useEffect(() => {
    const mount = mountRef.current;
    const w = mount.clientWidth;
    const h = mount.clientHeight;

    const scene  = new THREE.Scene();
    scene.background = new THREE.Color('#0a0e1a');

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.001, 200);

    const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearAlpha(1);
    mount.appendChild(renderer.domElement);

    // Planet group
    const planet = new THREE.Group();
    const surfaceGroup = new THREE.Group();
    surfaceGroup.userData.kind = 'surface';
    planet.add(surfaceGroup);

    const markerRoot = new THREE.Group();
    markerRoot.userData.kind = 'markers-root';
    planet.add(markerRoot);

    // Continents are rebuilt when real data lands; track them so we can swap.
    const continentsGroup = new THREE.Group();
    continentsGroup.userData.kind = 'continents';
    planet.add(continentsGroup);

    function disposeObject3D(child) {
      child.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const materials = Array.isArray(o.material) ? o.material : [o.material];
          materials.forEach(m => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        }
      });
    }

    function rebuildSurface(outlinePx = surfaceGroup.userData.outlinePx || 12, mode = surfaceGroup.userData.mode || renderMode) {
      while (surfaceGroup.children.length) {
        const child = surfaceGroup.children.pop();
        disposeObject3D(child);
      }
      surfaceGroup.userData.outlinePx = outlinePx;
      surfaceGroup.userData.mode = mode;
      surfaceGroup.add(buildPlanetSurface(window.CONTINENTS || [], outlinePx, mode));
      
      const modeObj = PlanetRenderRegistry.get(mode);
      const markerMode = modeObj.getMarkerMode ? modeObj.getMarkerMode() : 'surface';
      rebuildMarkers(markers, markerMode);
    }

    function rebuildContinents() {
      rebuildSurface();
      // Dispose old meshes
      while (continentsGroup.children.length) {
        const child = continentsGroup.children.pop();
        disposeObject3D(child);
      }
      // The opaque surface texture carries the land fill and coastline outline.
      // Keeping the old polygon mesh out avoids projection artifacts that looked
      // like inland lakes on large landmasses.
      // Procedural ice cap is no longer needed — ne_110m_land includes Antarctica
      // as a real polygon, so we skip the fallback cap entirely.
    }

    function rebuildMarkers(nextMarkers = markers, mode = renderMode) {
      while (markerRoot.children.length) {
        const child = markerRoot.children.pop();
        disposeObject3D(child);
      }
      const markerGroup = buildMarkers(nextMarkers, mode);
      markerRoot.add(markerGroup);
      markerRoot.userData.markerGroup = markerGroup;
    }
    rebuildContinents();
    rebuildMarkers();

    // Kick off real-data fetch and rebuild when it lands.
    if (typeof window.loadRealContinents === 'function') {
      window.loadRealContinents()
        .then(() => rebuildContinents())
        .catch(err => console.warn('Continent data fetch failed; using fallback.', err));
    }

    scene.add(planet);

    // Atmosphere — soft halo using an additive back-side sphere
    const atmoGeo = new THREE.SphereGeometry(1.06, 64, 48);
    const atmoMat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color(0.45, 0.7, 1.0) }
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.7 - dot(vNormal, vec3(0,0,1.0)), 2.0);
          gl_FragColor = vec4(uColor, 1.0) * intensity;
        }`
    });
    const atmo = new THREE.Mesh(atmoGeo, atmoMat);
    scene.add(atmo);

    // Stars (only visible far out)
    const stars = buildStarfield();
    scene.add(stars);

    // Ground detail patch — disabled in critter-board styling. Far out and
    // up close, the planet is a clean cartoon shape; no roads or buildings.

    // Controls
    const controls = new GlobeControls(camera, renderer.domElement);
    const initialView = START_VIEWS[startView] || START_VIEWS.globe;
    controls.jumpTo(
      initialView.lng,
      initialView.lat,
      1 + initialView.alt_m / EARTH_RADIUS_M
    );
    stateRef.current.controls = controls;
    stateRef.current.scene    = scene;
    stateRef.current.camera   = camera;
    stateRef.current.renderer = renderer;
    stateRef.current.setRenderMode = (mode) => rebuildSurface(surfaceGroup.userData.outlinePx || 12, mode);
    stateRef.current.setMarkers = (nextMarkers) => {
      const list = Array.isArray(nextMarkers) ? nextMarkers : [];
      rebuildMarkers(list, surfaceGroup.userData.mode);
    };
    window.__planet  = planet;
    window.__scene   = scene;
    window.__camera  = camera;
    window.__controls = controls;
    window.__renderer = renderer;
    window.__setMarkers = stateRef.current.setMarkers;
    window.__markers = () => markerRoot.userData.markerGroup?.userData.items?.map(item => item.userData.marker) || [];

    // Raycasting for Custom Marker Placement
    function handleCanvasClick(e) {
      if (!stateRef.current.isPlacingMode) return;

      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects(surfaceGroup.children, true);
      if (intersects.length > 0) {
        const point = intersects[0].point;
        const surfacePos = point.clone().normalize();
        const { lat, lng } = vec3ToLngLat(surfacePos);

        if (stateRef.current.onGlobeClick) {
          stateRef.current.onGlobeClick(lng, lat);
        }
      }
    }
    renderer.domElement.addEventListener('click', handleCanvasClick);

    // Resize
    function onResize() {
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', onResize);

    // Animate
    let raf, tickCount = 0;
    window.__tickCount = () => tickCount;
    function tick() {
      tickCount++;
      try {
      controls.tick();
      const alt = (controls.radius - 1) * EARTH_RADIUS_M;
      const nextOutlinePx = outlineWidthForAltitude(alt);
      if (surfaceGroup.userData.mode === 'surface' && nextOutlinePx !== surfaceGroup.userData.outlinePx) {
        rebuildSurface(nextOutlinePx, surfaceGroup.userData.mode);
      }

      // Compute focus point (where the camera looks at the surface)
      const dir = camera.position.clone().normalize();
      const surface = dir.clone().multiplyScalar(1.0);
      const { lat, lng } = vec3ToLngLat(surface);

      // No ground patch — cartoon planet stays clean at all zoom levels.

      // Fade atmosphere / stars based on altitude
      atmoMat.opacity = THREE.MathUtils.clamp(alt / 1_000_000, 0, 1);
      stars.material.opacity = THREE.MathUtils.clamp(alt / 8_000_000, 0, 1);
      stars.material.transparent = true;

      // Atmosphere color morphing depending on render mode
      const currentMode = surfaceGroup.userData.mode;
      const modeObj = PlanetRenderRegistry.get(currentMode);
      const atmoColor = modeObj.getAtmosphereColor ? modeObj.getAtmosphereColor() : new THREE.Color(0.45, 0.7, 1.0);
      atmoMat.uniforms.uColor.value.copy(atmoColor);

      // Delegate custom surface updates to current mode
      PlanetRenderRegistry.animate(currentMode, surfaceGroup, { alt, time: performance.now() });

      // Animate custom holographic city markers and links inside the marker root group
      markerRoot.traverse(child => {
        if (child.userData) {
          // Dynamic orbital marker rotation!
          if (child.userData.isOrbital && child.userData.orbitE1 && child.userData.orbitE2) {
            child.userData.orbitAngle += child.userData.orbitSpeed * 0.18;
            const theta = child.userData.orbitAngle;
            const e1 = child.userData.orbitE1;
            const e2 = child.userData.orbitE2;
            const alt = child.userData.altitude;
            
            _vOrb1.copy(e1).multiplyScalar(Math.cos(theta));
            _vOrb2.copy(e2).multiplyScalar(Math.sin(theta));
            _vOrbUp.addVectors(_vOrb1, _vOrb2).normalize();

            child.children.forEach(sub => {
              if (sub.userData.isPulsingRing || sub.userData.isRotatingRing || sub.userData.isHalo) {
                _vOrbPos.copy(_vOrbUp).multiplyScalar(alt + 0.001);
                sub.position.copy(_vOrbPos);
                _qOrb.setFromUnitVectors(_vAxisZ, _vOrbUp);
                sub.quaternion.copy(_qOrb);
              } else {
                let offset = 0;
                if (child.userData.marker.shape === 'cube') offset = child.userData.marker.size * 0.58;
                else if (child.userData.marker.shape === 'bar') offset = (child.userData.marker.height || child.userData.marker.size * 2.8) * 0.5;
                else offset = child.userData.marker.size * 1.15;
                
                if (sub.userData.isCyberpunkBeacon) offset = 0;
                
                _vOrbPos.copy(_vOrbUp).multiplyScalar(alt + offset);
                sub.position.copy(_vOrbPos);
                orientToSurface(sub, _vOrbUp);
              }
            });

            const labelHeight = child.userData.labelHeight;
            _vOrbPos.copy(_vOrbUp).multiplyScalar(alt + labelHeight);
            child.userData.anchor.copy(_vOrbPos);
          }

          if (child.userData.isPulsingRing) {
            if (!child.userData.scaleVal) child.userData.scaleVal = 1.0;
            child.userData.scaleVal += child.userData.pulseSpeed;
            if (child.userData.scaleVal > child.userData.maxScale) {
              child.userData.scaleVal = 0.5;
            }
            child.scale.set(child.userData.scaleVal, child.userData.scaleVal, 1);
            child.material.opacity = (1.0 - (child.userData.scaleVal - 0.5) / (child.userData.maxScale - 0.5)) * 0.7;
          }
          if (child.userData.isRotatingRing) {
            child.rotation.z += child.userData.rotSpeed;
          }
          if (child.userData.isCyberpunkBeacon) {
            const scaleY = 1.0 + Math.sin(performance.now() * 0.008 + hash(child.position.x, child.position.y) * 10) * 0.15;
            child.scale.set(1, scaleY, 1);
          }
          if (child.userData.particles && child.userData.pPoints) {
            const particles = child.userData.particles;
            const pPoints = child.userData.pPoints;
            const posAttr = pPoints.geometry.getAttribute('position');
            for (let p = 0; p < particles.length; p++) {
              const pt = particles[p];
              pt.t += pt.speed * 0.014;
              if (pt.t > 1) pt.t = 0;
              const pos = pt.curveObj.curve.getPointAt(pt.t);
              posAttr.setXYZ(p, pos.x, pos.y, pos.z);
            }
            posAttr.needsUpdate = true;
          }
        }
      });

      // No city markers anymore.
      window.GlobeController.updateMarkerLabels(projectMarkerLabels(markerRoot.userData.markerGroup, camera, renderer.domElement));

      // HUD
      const scaleBarLabel = formatScaleBar(controls.radius, camera, renderer.domElement.clientWidth);
      window.GlobeController.updateHUD({
        altitude: alt,
        focusLat: lat,
        focusLng: lng,
        scaleLabel: formatAltitude(alt),
        scaleBarPx: scaleBarLabel.px,
        scaleBarLabel: scaleBarLabel.label
      });

      renderer.render(scene, camera);
      } catch(e) { console.error('tick error', e); }
      raf = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('click', handleCanvasClick);
      renderer.dispose();
      delete window.__setMarkers;
      delete window.__markers;
      mount.removeChild(renderer.domElement);
    };
  }, []);

  // Headless control aliases for component render compatibility
  const flyTo = (lng, lat, alt_m) => window.GlobeController.flyTo(lng, lat, alt_m);
  const setInitialView = (view) => window.GlobeController.setStartView(view);
  const selectRenderMode = (mode) => window.GlobeController.setRenderMode(mode);
  const setPlacingMode = (val) => val ? window.GlobeController.startPlacing() : window.GlobeController.cancelPlacing();

  return (
    <div className={`root ${renderMode === 'cyberpunk' ? 'mode-cyberpunk' : ''}`}>
      <div ref={mountRef} className="canvas-mount" />

      <AltitudeCoordinatesHUD hud={hud} />
      <ScaleBarHUD hud={hud} />

      <div className="marker-layer" aria-hidden="true">
        {markerLabels.map(marker => marker.visible && (
          <div
            key={marker.id}
            className="marker-label"
            style={{ left: marker.x, top: marker.y }}
          >
            <span className="marker-swatch" style={{ color: marker.color, background: marker.color }} />
            <span className="marker-text">{marker.label}</span>
          </div>
        ))}
      </div>

      <div className="hud-overlay-container">
        <StartLevelControl startView={startView} setInitialView={setInitialView} />
        <RenderModeControl renderMode={renderMode} selectRenderMode={selectRenderMode} />
        <QuickJumpControl flyTo={flyTo} />
        <MarkerManager 
          markers={markers} 
          setMarkers={(list) => window.GlobeController.setMarkers(list)} 
          flyTo={flyTo}
          placingMode={placingMode}
          setPlacingMode={setPlacingMode}
          stateRef={stateRef}
          linksEnabled={linksEnabled}
        />
      </div>

      {placingMode && (
        <div className="placing-toast">
          Click on the globe to place your custom marker
        </div>
      )}

      <div className="hint">drag to pan · scroll to zoom</div>
    </div>
  );
}

// =============================================================================
// Helpers — HUD formatting
// =============================================================================
function formatAltitude(m) {
  if (m >= 1_000_000) return (m / 1_000_000).toFixed(1) + ' Mm';
  if (m >= 1000)      return (m / 1000).toFixed(m < 10_000 ? 1 : 0) + ' km';
  if (m >= 1)         return m.toFixed(1) + ' m';
  return (m * 100).toFixed(0) + ' cm';
}

function formatScaleBar(radius, camera, screenW) {
  // pick a "round" length that's roughly 1/6 of screen width
  const alt = (radius - 1);
  // How many meters per pixel approximately?
  const vfov = camera.fov * Math.PI / 180;
  const visibleHeight = 2 * Math.tan(vfov/2) * alt; // in scene units (≈ radians)
  const m_per_pixel   = (visibleHeight * EARTH_RADIUS_M) / screenW * (screenW / (screenW * 0.6));
  // simplified
  const targetPx = 160;
  const target_m = m_per_pixel * targetPx;

  const niceVals_m = [1, 2, 5, 10, 20, 50, 100, 200, 500,
                      1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000, 200_000, 500_000,
                      1_000_000, 2_000_000, 5_000_000, 10_000_000];
  let chosen = niceVals_m[0];
  for (const v of niceVals_m) if (v <= target_m) chosen = v;
  const px = chosen / m_per_pixel;
  const label = chosen >= 1000 ? (chosen/1000) + ' km' : chosen + ' m';
  return { px: Math.max(40, Math.min(screenW * 0.4, px)), label };
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
