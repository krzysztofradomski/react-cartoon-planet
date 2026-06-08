import assert from "node:assert/strict";
import {
  lngLatToVec3,
  vec3ToLngLat,
  cleanRing,
  hash,
  outlineWidthForAltitude,
} from "../src/engine/geo/math.ts";

const sample = { lng: -74.006, lat: 40.7128 };
const v = lngLatToVec3(sample.lng, sample.lat, 1);
const back = vec3ToLngLat(v);
assert.ok(
  Math.abs(back.lng - sample.lng) < 0.001,
  `lng round-trip: ${back.lng}`,
);
assert.ok(
  Math.abs(back.lat - sample.lat) < 0.001,
  `lat round-trip: ${back.lat}`,
);

const ring = cleanRing([
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 0],
]);
assert.equal(ring.length, 3);

assert.equal(hash(1, 2), hash(1, 2));
assert.notEqual(hash(1, 2), hash(2, 1));

// Coastline outlines are baked into a fixed 4096px-wide texture (= 360° of lng),
// so the stroke's pixel width maps to a fixed geographic half-width. If it grows
// too wide at ground level it paints the whole magnified texel near-black and
// swallows inland views (the Warsaw "black screen at 1.5km" bug). Guard the
// invariant across the full altitude range, especially the ground-level fly
// targets used by flyToMarker (350m) and the demo (1500m).
const TEXTURE_WIDTH_PX = 4096;
const KM_PER_DEG = 111;
function outlineHalfWidthKm(altM: number) {
  const px = outlineWidthForAltitude(altM);
  return (px / 2 / TEXTURE_WIDTH_PX) * 360 * KM_PER_DEG;
}
// Warsaw sits ~250km inland; keep the stroke well under that so inland ground
// views render land, not the outline colour.
for (const altM of [
  350, 1_500, 5_000, 50_000, 200_000, 1_000_000, 14_000_000,
]) {
  const halfKm = outlineHalfWidthKm(altM);
  assert.ok(
    halfKm < 100,
    `outline half-width at ${altM}m is ${halfKm.toFixed(0)}km (must stay <100km)`,
  );
}

console.log("geo/math tests passed");
