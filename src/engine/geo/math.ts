/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import * as THREE from 'three';
import earcut from 'earcut';

export function lngLatToVec3(lng, lat, radius = 1) {
  const phi   = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
     radius * Math.cos(phi),
     radius * Math.sin(phi) * Math.sin(theta)
  );
}

export function vec3ToLngLat(v) {
  const r   = v.length();
  const lat = 90 - (Math.acos(v.y / r) * 180 / Math.PI);
  let lng   = (Math.atan2(v.z, -v.x) * 180 / Math.PI) - 180;
  while (lng < -180) lng += 360;
  while (lng >  180) lng -= 360;
  return { lat, lng };
}

// Build local tangent-space basis at a lat/lng on a sphere of given radius.
export function tangentFrame(lng, lat, radius) {
  const center = lngLatToVec3(lng, lat, radius);
  const up     = center.clone().normalize();
  const north  = lngLatToVec3(lng, lat + 0.0001, radius).sub(center).normalize();
  const east   = new THREE.Vector3().crossVectors(up, north).normalize().negate();
  const northC = new THREE.Vector3().crossVectors(east, up).normalize();
  return { center, up, east, north: northC };
}

// Densify a polygon ring so straight (lng,lat) edges curve on the sphere.
export function subdivideRing(ring, maxDegPerSeg = 1.5) {
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

export function cleanRing(ring) {
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
export function subdivideTriangles(verts2D, idx, maxLen = 8) {
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

export function hash(x, y) {
  let h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return h - Math.floor(h);
}

export function outlineWidthForAltitude(alt_m) {
  // Outlines are baked into a fixed-resolution (4096px) texture, so a stroke of
  // N px maps to a fixed *geographic* width (~9.8km per px). On screen that width
  // scales with magnification, so a fixed px stroke balloons as you zoom in — a
  // 14px coastline that reads as a crisp line from orbit becomes a ~35px black
  // blob at continent scale. To hold a roughly constant on-screen thickness we
  // shrink the stroke as altitude drops (screen px ≈ texPx · 8.4e6 / alt_m).
  // Below ~1Mm the texture's ~9.8km texel is itself the floor, so 1px is as thin
  // as it gets — but that also keeps the stroke far too narrow to swallow inland
  // areas (the old Warsaw black-screen bug).
  if (alt_m >= 8_000_000) return 12; // orbit: bold cartoon coastline
  if (alt_m >= 4_000_000) return 7;
  if (alt_m >= 2_000_000) return 4;
  if (alt_m >= 1_000_000) return 3;
  if (alt_m >= 300_000) return 2;
  return 1;
}
