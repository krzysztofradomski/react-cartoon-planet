import assert from 'node:assert/strict';
import { haversineMeters, offsetLngLatMeters } from '../src/engine/geo/distance.ts';
import { resolveDisplayMarkers, spreadOverlappingMarkers } from '../src/engine/markers/markerDisplay.ts';
import { WARSAW_BUG_MARKERS } from '../src/types.ts';

const bugs = WARSAW_BUG_MARKERS;

const d12 = haversineMeters(bugs[0].lng, bugs[0].lat, bugs[1].lng, bugs[1].lat);
const d23 = haversineMeters(bugs[1].lng, bugs[1].lat, bugs[2].lng, bugs[2].lat);
assert.ok(d12 >= 0.8 && d12 <= 2.5, `ladybug-mosquito distance: ${d12}m`);
assert.ok(d23 >= 0.8 && d23 <= 2.5, `mosquito-hornet distance: ${d23}m`);

const spread = spreadOverlappingMarkers(bugs, 3);
for (let i = 0; i < spread.length; i++) {
  for (let j = i + 1; j < spread.length; j++) {
    const d = haversineMeters(spread[i].lng, spread[i].lat, spread[j].lng, spread[j].lat);
    assert.ok(d >= 2.5, `spread pair ${i}-${j} too close: ${d}m`);
  }
}

const ground = resolveDisplayMarkers(bugs, 1500, 5);
assert.equal(ground.length, 3, 'ground view shows 3 individuals');
assert.ok(!ground.some((m) => m.isCluster), 'no clusters at ground');

const globe = resolveDisplayMarkers(bugs, 14_000_000, 50_000);
assert.equal(globe.length, 1, 'globe view clusters into one');
assert.equal(globe[0].clusterCount, 3);

const moved = offsetLngLatMeters(21, 52, 10, 10);
assert.ok(Math.abs(moved.lat - 52) > 0, 'north offset changes lat');

console.log('marker display tests passed');
