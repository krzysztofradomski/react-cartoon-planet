import assert from 'node:assert/strict';
import { haversineMeters, offsetLngLatMeters } from '../src/engine/geo/distance.ts';
import { resolveDisplayMarkers, spreadOverlappingMarkers } from '../src/engine/markers/markerDisplay.ts';
import { WARSAW_BUG_MARKERS } from '../src/types.ts';

const bugs = WARSAW_BUG_MARKERS;

const d12 = haversineMeters(bugs[0].lng, bugs[0].lat, bugs[1].lng, bugs[1].lat);
const d23 = haversineMeters(bugs[1].lng, bugs[1].lat, bugs[2].lng, bugs[2].lat);
assert.ok(d12 >= 0.8 && d12 <= 2.5, `ladybug-mosquito distance: ${d12}m`);
assert.ok(d23 >= 0.8 && d23 <= 2.5, `mosquito-hornet distance: ${d23}m`);

// Default spread (0.5 m): Warsaw bugs are ~0.8–2.5 m apart — keep true coords.
const spreadDefault = spreadOverlappingMarkers(bugs, 0.5);
for (const m of spreadDefault) {
  const orig = bugs.find((b) => b.id === m.id)!;
  const drift = haversineMeters(orig.lng, orig.lat, m.lng, m.lat);
  assert.ok(drift < 0.01, `${m.id} should stay at true position (drift ${drift}m)`);
}

// Placing between two bugs must not reshuffle the originals onto a new ring.
const placed = {
  id: 'custom_placed',
  label: 'Placed',
  lng: (bugs[0].lng + bugs[1].lng) / 2,
  lat: (bugs[0].lat + bugs[1].lat) / 2,
  shape: 'icon' as const,
  color: '#fff',
  size: 0.03,
};
const four = [...bugs, placed];
const spread4 = spreadOverlappingMarkers(four, 0.5);
for (const id of ['warsaw-ladybug', 'warsaw-mosquito', 'warsaw-hornet']) {
  const orig = bugs.find((b) => b.id === id)!;
  const out = spread4.find((m) => m.id === id)!;
  const drift = haversineMeters(orig.lng, orig.lat, out.lng, out.lat);
  assert.ok(drift < 0.01, `${id} must not move when a 4th marker is added (drift ${drift}m)`);
}
const placedOut = spread4.find((m) => m.id === 'custom_placed')!;
const placedDrift = haversineMeters(placed.lng, placed.lat, placedOut.lng, placedOut.lat);
assert.ok(
  placedDrift < 0.01,
  `placed marker should stay at click coordinate (drift ${placedDrift}m)`
);

// Tight pile still fans out (all pairs within threshold).
const pile = bugs.map((m, i) => ({ ...m, lng: bugs[0].lng, lat: bugs[0].lat, id: `pile-${i}` }));
const spreadPile = spreadOverlappingMarkers(pile, 0.5);
for (let i = 0; i < spreadPile.length; i++) {
  for (let j = i + 1; j < spreadPile.length; j++) {
    const d = haversineMeters(
      spreadPile[i].lng,
      spreadPile[i].lat,
      spreadPile[j].lng,
      spreadPile[j].lat
    );
    assert.ok(d >= 0.25, `coincident pile pair ${i}-${j} should separate: ${d}m`);
  }
}

const ground = resolveDisplayMarkers(bugs, 1500, 5);
assert.equal(ground.length, 3, 'ground view shows 3 individuals');
assert.ok(!ground.some((m) => m.isCluster), 'no clusters at ground');

const globe = resolveDisplayMarkers(bugs, 14_000_000, 50_000);
assert.equal(globe.length, 1, 'globe view clusters into one');
assert.equal(globe[0].clusterCount, 3);

// A marker placed away from the pest pile must not join their cluster when zoomed out.
const far = offsetLngLatMeters(21.0122, 52.2297, 0, 40);
const placedFar = {
  id: 'custom_far',
  label: 'Far',
  lng: far.lng,
  lat: far.lat,
  shape: 'icon' as const,
  color: '#fff',
  size: 0.03,
};
const zoomed = resolveDisplayMarkers([...bugs, placedFar], 14_000_000, 50_000);
assert.equal(zoomed.length, 2, 'distant placement stays separate from pest cluster');
assert.ok(zoomed.some((m) => m.isCluster && m.clusterCount === 3));
assert.ok(zoomed.some((m) => m.id === 'custom_far' && !m.isCluster));

const moved = offsetLngLatMeters(21, 52, 10, 10);
assert.ok(Math.abs(moved.lat - 52) > 0, 'north offset changes lat');

console.log('marker display tests passed');
