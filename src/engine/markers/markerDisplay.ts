/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import type { Marker } from '../../types';
import { haversineMeters, offsetLngLatMeters } from '../geo/distance.ts';

export interface MarkerDisplayOptions {
  /** Minimum surface separation when showing individuals (meters). Default 3. */
  minSeparationM?: number;
  /** Screen-space radius used to decide clustering (pixels). Default 40. */
  clusterPixelRadius?: number;
  /** Below this altitude, always spread individuals; above, cluster by screen overlap. */
  spreadOnlyBelowM?: number;
}

const DEFAULT_OPTIONS: Required<MarkerDisplayOptions> = {
  minSeparationM: 3,
  clusterPixelRadius: 40,
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
  for (let i = 0; i < markers.length; i++) {
    for (let j = i + 1; j < markers.length; j++) {
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

    indices.forEach((idx, slot) => {
      const angle = (slot / count) * Math.PI * 2 - Math.PI / 2;
      const eastM = Math.cos(angle) * ringRadius;
      const northM = Math.sin(angle) * ringRadius;
      const pos = offsetLngLatMeters(centerLng, centerLat, eastM, northM);
      result[idx] = cloneMarker(markers[idx], { lng: pos.lng, lat: pos.lat });
    });
  }

  return result;
}

function buildClusterMarker(members: Marker[], id: string): Marker {
  const sumLng = members.reduce((s, m) => s + m.lng, 0);
  const sumLat = members.reduce((s, m) => s + m.lat, 0);
  const dominant = members[0];

  return {
    id,
    label: members.length === 1 ? dominant.label : `${members.length} pests`,
    lng: sumLng / members.length,
    lat: sumLat / members.length,
    shape: 'orb',
    color: dominant.color || '#ff5e3a',
    size: 0.016,
    isCluster: true,
    clusterCount: members.length,
    memberIds: members.map((m) => m.id),
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
  if (valid.length === 1) return spreadOverlappingMarkers(valid, opts.minSeparationM);

  const clusterRadiusM = Math.max(5, metersPerPx * opts.clusterPixelRadius);

  // Near ground: always show individuals with visual separation.
  if (altitudeMeters <= opts.spreadOnlyBelowM) {
    return spreadOverlappingMarkers(valid, opts.minSeparationM);
  }

  const uf = new UnionFind(valid.length);
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const d = haversineMeters(valid[i].lng, valid[i].lat, valid[j].lng, valid[j].lat);
      if (d <= clusterRadiusM) uf.union(i, j);
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
    } else {
      display.push(buildClusterMarker(members, `cluster_${members.map((m) => m.id).join('_')}`));
    }
  }

  return display;
}
