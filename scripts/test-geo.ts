import assert from 'node:assert/strict';
import { lngLatToVec3, vec3ToLngLat, cleanRing, hash } from '../src/engine/geo/math.ts';

const sample = { lng: -74.006, lat: 40.7128 };
const v = lngLatToVec3(sample.lng, sample.lat, 1);
const back = vec3ToLngLat(v);
assert.ok(Math.abs(back.lng - sample.lng) < 0.001, `lng round-trip: ${back.lng}`);
assert.ok(Math.abs(back.lat - sample.lat) < 0.001, `lat round-trip: ${back.lat}`);

const ring = cleanRing([
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 0],
]);
assert.equal(ring.length, 3);

assert.equal(hash(1, 2), hash(1, 2));
assert.notEqual(hash(1, 2), hash(2, 1));

console.log('geo/math tests passed');
