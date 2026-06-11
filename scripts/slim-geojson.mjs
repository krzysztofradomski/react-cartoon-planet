// Slims a GeoJSON file for globe-scale rendering: rounds coordinates to 4
// decimal places (~11 m on Earth, ~3 m on the Moon) and drops ring points
// closer than TOLERANCE_DEG to the previously kept point. The globe rasterizes
// these polygons onto a 4096px-wide canvas (1 px ≈ 0.088°), so detail below
// ~0.02° is invisible. Usage:
//   node scripts/slim-geojson.mjs src/assets/moon-maria.geojson
import { readFileSync, writeFileSync } from 'node:fs';

const TOLERANCE_DEG = 0.02;
const PRECISION = 1e4;

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/slim-geojson.mjs <file.geojson>');
  process.exit(1);
}

const round = (n) => Math.round(n * PRECISION) / PRECISION;

function simplifyRing(ring) {
  const out = [];
  let last = null;
  for (const [lng, lat] of ring) {
    const p = [round(lng), round(lat)];
    if (last && Math.abs(p[0] - last[0]) < TOLERANCE_DEG && Math.abs(p[1] - last[1]) < TOLERANCE_DEG) {
      continue;
    }
    out.push(p);
    last = p;
  }
  // Re-close the ring; the simplifier may have dropped the closing point.
  if (out.length >= 3) {
    const [first, end] = [out[0], out[out.length - 1]];
    if (first[0] !== end[0] || first[1] !== end[1]) out.push([first[0], first[1]]);
  }
  return out;
}

function simplifyGeometry(geometry) {
  if (!geometry) return geometry;
  if (geometry.type === 'Polygon') {
    geometry.coordinates = geometry.coordinates.map(simplifyRing).filter((r) => r.length >= 4);
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates = geometry.coordinates
      .map((poly) => poly.map(simplifyRing).filter((r) => r.length >= 4))
      .filter((poly) => poly.length > 0);
  }
  return geometry;
}

const geo = JSON.parse(readFileSync(file, 'utf8'));
const before = readFileSync(file).length;
let pointsBefore = 0;
let pointsAfter = 0;

const countPoints = (g) =>
  g?.type === 'Polygon'
    ? g.coordinates.reduce((n, r) => n + r.length, 0)
    : g?.type === 'MultiPolygon'
      ? g.coordinates.reduce((n, p) => n + p.reduce((m, r) => m + r.length, 0), 0)
      : 0;

geo.features = geo.features.filter((f) => {
  pointsBefore += countPoints(f.geometry);
  simplifyGeometry(f.geometry);
  const after = countPoints(f.geometry);
  pointsAfter += after;
  return after > 0;
});

writeFileSync(file, JSON.stringify(geo));
const after = readFileSync(file).length;
console.log(
  `${file}: ${(before / 1e6).toFixed(2)} MB → ${(after / 1e6).toFixed(2)} MB, ` +
    `${pointsBefore} → ${pointsAfter} ring points`
);
