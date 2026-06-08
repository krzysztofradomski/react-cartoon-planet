import assert from "node:assert/strict";
import {
  haversineMeters,
  offsetLngLatMeters,
} from "../src/engine/geo/distance.ts";
import {
  resolveDisplayMarkers,
  spreadOverlappingMarkers,
} from "../src/engine/markers/markerDisplay.ts";
import { WARSAW_LANDMARK_MARKERS } from "../src/types.ts";

const landmarks = WARSAW_LANDMARK_MARKERS;

const d12 = haversineMeters(
  landmarks[0].lng,
  landmarks[0].lat,
  landmarks[1].lng,
  landmarks[1].lat,
);
const d23 = haversineMeters(
  landmarks[1].lng,
  landmarks[1].lat,
  landmarks[2].lng,
  landmarks[2].lat,
);
assert.ok(d12 >= 0.8 && d12 <= 2.5, `whisper-glass distance: ${d12}m`);
assert.ok(d23 >= 0.8 && d23 <= 2.5, `glass-pickle distance: ${d23}m`);

// Default spread (0.5 m): Warsaw landmarks are ~0.8–2.5 m apart — keep true coords.
const spreadDefault = spreadOverlappingMarkers(landmarks, 0.5);
for (const m of spreadDefault) {
  const orig = landmarks.find((b) => b.id === m.id)!;
  const drift = haversineMeters(orig.lng, orig.lat, m.lng, m.lat);
  assert.ok(
    drift < 0.01,
    `${m.id} should stay at true position (drift ${drift}m)`,
  );
}

// Placing between two landmarks must not reshuffle the originals onto a new ring.
const placed = {
  id: "custom_placed",
  label: "Placed",
  lng: (landmarks[0].lng + landmarks[1].lng) / 2,
  lat: (landmarks[0].lat + landmarks[1].lat) / 2,
  shape: "icon" as const,
  color: "#fff",
  size: 0.03,
};
const four = [...landmarks, placed];
const spread4 = spreadOverlappingMarkers(four, 0.5);
for (const id of [
  "warsaw-whisper-palace",
  "warsaw-glass-pier",
  "warsaw-pickle-tower",
]) {
  const orig = landmarks.find((b) => b.id === id)!;
  const out = spread4.find((m) => m.id === id)!;
  const drift = haversineMeters(orig.lng, orig.lat, out.lng, out.lat);
  assert.ok(
    drift < 0.01,
    `${id} must not move when a 4th marker is added (drift ${drift}m)`,
  );
}
const placedOut = spread4.find((m) => m.id === "custom_placed")!;
const placedDrift = haversineMeters(
  placed.lng,
  placed.lat,
  placedOut.lng,
  placedOut.lat,
);
assert.ok(
  placedDrift < 0.01,
  `placed marker should stay at click coordinate (drift ${placedDrift}m)`,
);

// Tight pile still fans out (all pairs within threshold).
const pile = landmarks.map((m, i) => ({
  ...m,
  lng: landmarks[0].lng,
  lat: landmarks[0].lat,
  id: `pile-${i}`,
}));
const spreadPile = spreadOverlappingMarkers(pile, 0.5);
for (let i = 0; i < spreadPile.length; i++) {
  for (let j = i + 1; j < spreadPile.length; j++) {
    const d = haversineMeters(
      spreadPile[i].lng,
      spreadPile[i].lat,
      spreadPile[j].lng,
      spreadPile[j].lat,
    );
    assert.ok(
      d >= 0.25,
      `coincident pile pair ${i}-${j} should separate: ${d}m`,
    );
  }
}

const ground = resolveDisplayMarkers(landmarks, 1500, 5);
assert.equal(ground.length, 3, "ground view shows 3 individuals");
assert.ok(!ground.some((m) => m.isCluster), "no clusters at ground");

const globe = resolveDisplayMarkers(landmarks, 14_000_000, 50_000);
assert.equal(globe.length, 1, "globe view clusters into one");
assert.equal(globe[0].clusterCount, 3);

// A marker placed away from the landmark pile must not join their cluster when zoomed out.
const far = offsetLngLatMeters(21.0122, 52.2297, 0, 40);
const placedFar = {
  id: "custom_far",
  label: "Far",
  lng: far.lng,
  lat: far.lat,
  shape: "icon" as const,
  color: "#fff",
  size: 0.03,
};
const zoomed = resolveDisplayMarkers(
  [...landmarks, placedFar],
  14_000_000,
  50_000,
);
assert.equal(
  zoomed.length,
  2,
  "distant placement stays separate from landmark cluster",
);
assert.ok(zoomed.some((m) => m.isCluster && m.clusterCount === 3));
assert.ok(zoomed.some((m) => m.id === "custom_far" && !m.isCluster));

const moved = offsetLngLatMeters(21, 52, 10, 10);
assert.ok(Math.abs(moved.lat - 52) > 0, "north offset changes lat");

console.log("marker display tests passed");
