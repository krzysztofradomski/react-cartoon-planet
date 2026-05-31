/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { lngLatToVec3, cleanRing, subdivideRing } from '../geo/math';
import { R_OCEAN } from '../constants/globeConstants';

// Sit just above the textured surface (R_OCEAN) so the line clears the land/ocean
// fill without z-fighting. The log-depth buffer resolves this tiny gap at every
// altitude, and the offset is sub-pixel from continent scale upward.
const OUTLINE_RADIUS = R_OCEAN + 0.0006;

function collectSegments(continents: any[]): number[] {
  const positions: number[] = [];
  for (const continent of continents) {
    if (continent.outline === false) continue;
    for (const ringDef of continent.rings || []) {
      if (ringDef && ringDef.outline === false) continue;
      const raw = Array.isArray(ringDef) ? ringDef : ringDef.points;
      // Densify only long lng/lat edges so they curve along the sphere instead of
      // cutting straight chords through it; dense coastlines are left untouched.
      const ring = subdivideRing(cleanRing(raw || []), 3);
      if (ring.length < 2) continue;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length]; // close the loop
        const va = lngLatToVec3(a[0], a[1], OUTLINE_RADIUS);
        const vb = lngLatToVec3(b[0], b[1], OUTLINE_RADIUS);
        positions.push(va.x, va.y, va.z, vb.x, vb.y, vb.z);
      }
    }
  }
  return positions;
}

/**
 * Coastlines as real geometry with screen-constant thickness — crisp at every
 * zoom, unlike a stroke baked into a fixed-resolution texture (which balloons as
 * you zoom in).
 *
 * `fat` picks the renderer:
 *  - false (default): plain GL_LINES at 1px — effectively free, but hairline on
 *    HiDPI and not widenable.
 *  - true: screen-space "fat" lines (LineSegments2) at `widthPx` — bolder and
 *    DPR-independent, but costs a shaded quad per segment.
 */
export function buildContinentOutlines(continents = [], options: any = {}) {
  const { color = '#0a0a14', fat = false, widthPx = 2.5, resolution = [1280, 800] } = options;

  const positions = collectSegments(continents);
  const group = new THREE.Group();
  group.userData.kind = 'continent-outline';
  if (positions.length === 0) return group;

  let lines;
  if (fat) {
    const geo = new LineSegmentsGeometry();
    geo.setPositions(positions);
    const mat = new LineMaterial({
      color: new THREE.Color(color),
      linewidth: widthPx, // pixels (worldUnits = false)
      worldUnits: false,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });
    mat.resolution.set(resolution[0], resolution[1]);
    lines = new LineSegments2(geo, mat);
  } else {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      depthWrite: false,
    });
    lines = new THREE.LineSegments(geo, mat);
  }

  lines.renderOrder = 4;
  lines.frustumCulled = false; // globe-spanning; its bounds always intersect the view
  lines.userData.isContinentOutline = true;
  group.add(lines);
  return group;
}

/** Keep every fat-line material's pixel width correct for the current canvas. */
export function updateContinentOutlineResolution(root: any, width: number, height: number) {
  root?.traverse?.((child: any) => {
    if (child.userData?.isContinentOutline && child.material?.resolution) {
      child.material.resolution.set(width, height);
    }
  });
}
