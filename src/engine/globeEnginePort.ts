import type { RefObject } from 'react';
import type { GlobeControlsLike, GlobeEnginePort, Marker } from '../types';

/** Typed bridge between React controller and the Three.js scene host. */
export interface GlobeEnginePortRef extends RefObject<GlobeEnginePort> {}

export function bindEnginePort(
  portRef: GlobeEnginePortRef,
  bindings: Partial<GlobeEnginePort>
): void {
  if (!portRef.current) {
    portRef.current = {};
  }
  Object.assign(portRef.current, bindings);
}

export function clearEnginePort(portRef: GlobeEnginePortRef): void {
  if (portRef.current) {
    portRef.current = {};
  }
}

export type SceneHostOptions = {
  getRenderMode: () => string;
  getMarkers: () => Marker[];
  getLinksEnabled: () => boolean;
  onGlobeClick?: (lng: number, lat: number) => void;
};

export type { GlobeControlsLike };
