/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import type { Marker } from '../../types';
import { haversineMeters, offsetLngLatMeters } from '../geo/distance.ts';

export interface MarkerDisplayOptions {
  /**
   * Only markers closer than this (meters) are nudged apart; anything farther
   * keeps its true coordinate. Kept small so real-world separation is preserved
   * (placement stays WYSIWYG) and only near-coincident markers fan out. Default 0.5.
   */
  minSeparationM?: number;
  /** Screen-space radius used to decide clustering (pixels). Default 40. */
  clusterPixelRadius?: number;
  /**
   * Max geographic span (m) for a cluster. Prevents transitive chaining
   * (A–B and B–C close, A–C far) from lumping a distant placed marker with a
   * tight pile. Default 25 m.
   */
  clusterMaxSpreadM?: number;
  /** Below this altitude, show every marker at its true coordinate. */
  spreadOnlyBelowM?: number;
}

const DEFAULT_OPTIONS: Required<MarkerDisplayOptions> = {
  minSeparationM: 0.5,
  clusterPixelRadius: 40,
  clusterMaxSpreadM: 25,
  spreadOnlyBelowM: 80_000,
};

class UnionFind {
  parent: number[];
  rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.rank = new Array(size).fill(0);
  }

  find(i: number): number {
    if (this.parent[i] !== i) this.parent[i] = this.find(this.parent[i]);
    return this.parent[i];
  }

  union(a: number, b: number) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    if (this.rank[ra] < this.rank[rb]) this.parent[ra] = rb;
    else if (this.rank[ra] > this.rank[rb]) this.parent[rb] = ra;
    else {
      this.parent[rb] = ra;
      this.rank[ra]++;
    }
  }
}

function cloneMarker(marker: Marker, overrides: Partial<Marker> = {}): Marker {
  return { ...marker, ...overrides };
}

/** Spread markers that sit closer than minSeparationM into a stable ring around their centroid. */
export function spreadOverlappingMarkers(markers: Marker[], minSeparationM: number): Marker[] {
  if (markers.length <= 1) return markers.map((m) => cloneMarker(m));

  const uf = new UnionFind(markers.length);
  const latThreshDegSpread = (minSeparationM / 111_132) * 2;
  for (let i = 0; i < markers.length; i++) {
    for (let j = i + 1; j < markers.length; j++) {
      if (Math.abs(markers[i].lat - markers[j].lat) > latThreshDegSpread) continue;
      const d = haversineMeters(markers[i].lng, markers[i].lat, markers[j].lng, markers[j].lat);
      if (d < minSeparationM) uf.union(i, j);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < markers.length; i++) {
    const root = uf.find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }

  const result = markers.map((m) => cloneMarker(m));

  for (const indices of groups.values()) {
    if (indices.length <= 1) continue;

    // Union-find can chain A–B and B–C when only the middle links are within
    // minSeparationM (e.g. placing between two bugs ~0.8 m apart). Only fan out
    // groups that are genuinely piled up, not loosely connected chains.
    let maxPairM = 0;
    for (let a = 0; a < indices.length; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        const d = haversineMeters(
          markers[indices[a]].lng,
          markers[indices[a]].lat,
          markers[indices[b]].lng,
          markers[indices[b]].lat
        );
        maxPairM = Math.max(maxPairM, d);
      }
    }
    if (maxPairM > minSeparationM) continue;

    let sumLng = 0;
    let sumLat = 0;
    for (const idx of indices) {
      sumLng += markers[idx].lng;
      sumLat += markers[idx].lat;
    }
    const centerLng = sumLng / indices.length;
    const centerLat = sumLat / indices.length;

    const count = indices.length;
    const ringRadius = Math.max(minSeparationM * 0.55, (minSeparationM * count) / (2 * Math.PI));

    // Assign ring slots by a stable key (id) rather than array order so adding
    // or removing a marker doesn't reshuffle the others' positions.
    const ordered = [...indices].sort((a, b) =>
      String(markers[a].id ?? a).localeCompare(String(markers[b].id ?? b))
    );

    ordered.forEach((idx, slot) => {
      const angle = (slot / count) * Math.PI * 2 - Math.PI / 2;
      const eastM = Math.cos(angle) * ringRadius;
      const northM = Math.sin(angle) * ringRadius;
      const pos = offsetLngLatMeters(centerLng, centerLat, eastM, northM);
      result[idx] = cloneMarker(markers[idx], { lng: pos.lng, lat: pos.lat });
    });
  }

  return result;
}

/**
 * Altitude (m) at which a cluster's members fill a comfortable fraction of the
 * view, so clicking the cluster drills down far enough to actually separate
 * them. A tight group (e.g. pests ~3m apart) resolves to ~ground level; a wide
 * group (cities) stays high. Without this, clicking a cluster flew to a fixed
 * altitude where tightly-packed members still stacked on one point.
 */
function clusterFrameAltitudeM(members: Marker[], centerLng: number, centerLat: number): number {
  let maxFromCenter = 0;
  for (const m of members) {
    maxFromCenter = Math.max(maxFromCenter, haversineMeters(centerLng, centerLat, m.lng, m.lat));
  }
  const spanM = Math.max(2, maxFromCenter * 2);
  // visible ground width ≈ 0.93 * altitude (50° vfov); frame the span at ~60% of it.
  return Math.min(8_000_000, Math.max(6, spanM / 0.56));
}

function buildClusterMarker(members: Marker[], id: string): Marker {
  const sumLng = members.reduce((s, m) => s + m.lng, 0);
  const sumLat = members.reduce((s, m) => s + m.lat, 0);
  const dominant = members[0];
  const centerLng = sumLng / members.length;
  const centerLat = sumLat / members.length;

  return {
    id,
    label: members.length === 1 ? dominant.label : `${members.length} pests`,
    lng: centerLng,
    lat: centerLat,
    shape: 'orb',
    color: dominant.color || '#ff5e3a',
    size: 0.016,
    isCluster: true,
    clusterCount: members.length,
    memberIds: members.map((m) => m.id),
    frameAltitudeM: clusterFrameAltitudeM(members, centerLng, centerLat),
  };
}

/** Cluster markers that would overlap on screen; otherwise spread individuals. */
export function resolveDisplayMarkers(
  markers: Marker[],
  altitudeMeters: number,
  metersPerPx: number,
  options: MarkerDisplayOptions = {}
): Marker[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const valid = markers.filter((m) => Number.isFinite(m.lng) && Number.isFinite(m.lat));
  if (valid.length === 0) return [];
  if (valid.length === 1) return valid.map((m) => cloneMarker(m));

  const clusterRadiusM = Math.max(5, metersPerPx * opts.clusterPixelRadius);

  // Near ground: true coordinates only (screen-constant pins handle overlap).
  if (altitudeMeters <= opts.spreadOnlyBelowM) {
    return valid.map((m) => cloneMarker(m));
  }

  const uf = new UnionFind(valid.length);
  const latThreshDegCluster = (Math.min(clusterRadiusM, opts.clusterMaxSpreadM) / 111_132) * 2;
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      if (Math.abs(valid[i].lat - valid[j].lat) > latThreshDegCluster) continue;
      const d = haversineMeters(valid[i].lng, valid[i].lat, valid[j].lng, valid[j].lat);
      if (d <= clusterRadiusM && d <= opts.clusterMaxSpreadM) uf.union(i, j);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < valid.length; i++) {
    const root = uf.find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }

  const display: Marker[] = [];
  for (const indices of groups.values()) {
    const members = indices.map((i) => valid[i]);
    if (members.length === 1) {
      display.push(cloneMarker(members[0]));
      continue;
    }

    // Belt-and-suspenders: reject loose chains that slipped through union-find.
    let maxPairM = 0;
    for (let a = 0; a < members.length; a++) {
      for (let b = a + 1; b < members.length; b++) {
        maxPairM = Math.max(
          maxPairM,
          haversineMeters(members[a].lng, members[a].lat, members[b].lng, members[b].lat)
        );
      }
    }
    if (maxPairM > opts.clusterMaxSpreadM) {
      for (const m of members) display.push(cloneMarker(m));
      continue;
    }

    display.push(buildClusterMarker(members, `cluster_${members.map((m) => m.id).join('_')}`));
  }

  return display;
}
