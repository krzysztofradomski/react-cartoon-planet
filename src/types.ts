import type { Group } from 'three';

export type StartViewId = 'globe' | 'ground';
export type MarkerShape = 'orb' | 'cube' | 'bar';

/** GeoJSON or other map source referenced by local or remote URL. */
export interface PlanetMapDefinition {
  name: string;
  url: string;
  /** Pre-parsed continents; skips fetch when provided. */
  continents?: Continent[];
  oceanColor?: string;
  landColor?: string;
  atmosphereColor?: string;
  atmosphereStrength?: number;
}

/** Passed to custom renderFunction implementations. */
export interface GlobeRenderConfig {
  continents: Continent[];
  map: PlanetMapOptions & { name: string };
  outlinePx: number;
  altitude: number;
  time: number;
}

/** Fully customizable globe surface renderer. */
export interface GlobeRenderModeDefinition {
  name: string;
  renderFunction: (config: GlobeRenderConfig) => Group;
  getAtmosphereColor?: () => import('three').Color;
  getMarkerMode?: () => string;
  animate?: (group: Group, context: { alt: number; time: number }) => void;
}

export interface Marker {
  id: string;
  label: string;
  lng: number;
  lat: number;
  shape?: MarkerShape;
  color?: string;
  size?: number;
  height?: number;
  isOrbital?: boolean;
  altitude?: number;
  orbitNodeA?: string;
  orbitNodeB?: string;
}

export interface HudState {
  altitude: number;
  scaleLabel: string;
  focusLat: number;
  focusLng: number;
  scaleBarPx: number;
  scaleBarLabel: string;
}

export interface MarkerLabel {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
  visible: boolean;
}

export interface GlobeState {
  renderMode: string;
  planetMap: string;
  startView: StartViewId;
  markers: Marker[];
  placingMode: boolean;
  hud: HudState;
  fps: number;
  markerLabels: MarkerLabel[];
  linksEnabled: boolean;
}

export interface CartoonPlanetUiOptions {
  altitudeHud: boolean;
  scaleBar: boolean;
  fpsHud: boolean;
  markerLabels: boolean;
  hint: boolean;
  placingToast: boolean;
  startLevelControl: boolean;
  planetMapControl: boolean;
  renderModeControl: boolean;
  quickJumpControl: boolean;
  markerManagerControl: boolean;
}

export interface CartoonPlanetInitialState {
  map?: PlanetMapDefinition;
  renderMode?: GlobeRenderModeDefinition;
  startView?: StartViewId;
  markers?: Marker[];
  linksEnabled?: boolean;
}

export interface GlobeView {
  lng: number;
  lat: number;
  altitudeMeters: number;
}

export interface GlobeRotateOptions {
  /** Animation duration in ms. `0` applies instantly. Default: 600. */
  duration?: number;
}

export interface GlobeFlyOptions {
  /** Animation duration in ms. `0` applies instantly. Default: 1800. */
  duration?: number;
}

export interface GlobeAutoRotateOptions {
  /** Longitude spin speed in degrees per second. Default: 12. */
  speed?: number;
}

export interface GlobeControlsLike {
  flyTo(lng: number, lat: number, radius: number, duration?: number): void;
  flyToAltitude?(radius: number, duration?: number): void;
  rotateBy(lngDelta: number, latDelta: number, duration?: number): void;
  rotateTo(lng: number, lat: number, duration?: number): void;
  startAutoRotate?(speedDegPerSec?: number): void;
  stopAutoRotate?(): void;
  getView(): GlobeView;
}

export interface GlobeEnginePort {
  isPlacingMode?: boolean;
  onGlobeClick?: ((lng: number, lat: number) => void) | null;
  controls?: GlobeControlsLike;
  setRenderMode?: (modeName: string) => void;
  rebuildPlanetMap?: () => void;
  setMarkers?: (markers: Marker[]) => void;
}

/** @deprecated Use GlobeEnginePort */
export type GlobeRuntimeRef = GlobeEnginePort;

export interface CartoonPlanetController {
  getState(): GlobeState;
  subscribe(listener: (state: GlobeState) => void): () => void;
  getMaps(): PlanetMapDefinition[];
  getRenderModes(): GlobeRenderModeDefinition[];
  setRenderMode(mode: GlobeRenderModeDefinition | string): void;
  setPlanetMap(map: PlanetMapDefinition | string): void;
  setStartView(view: StartViewId): void;
  setMarkers(markers: Marker[]): void;
  addMarker(
    label: string,
    lat: number,
    lng: number,
    shape?: MarkerShape,
    color?: string,
    size?: number,
    isOrbital?: boolean,
    altitude?: number,
    orbitNodeA?: string,
    orbitNodeB?: string
  ): Marker;
  removeMarker(id: string): void;
  setLinksEnabled(enabled: boolean): void;
  startPlacing(): void;
  cancelPlacing(): void;
  flyTo(lng: number, lat: number, altitudeMeters: number, options?: GlobeFlyOptions): void;
  /** Zoom in or out while keeping the current heading. */
  flyToAltitude(altitudeMeters: number, options?: GlobeFlyOptions): void;
  flyToMarker(id: string): void;
  /** Rotate the view by delta degrees on longitude and latitude axes. Altitude is unchanged. */
  rotateBy(lngDelta: number, latDelta: number, options?: GlobeRotateOptions): void;
  /** Rotate the view to an absolute lng/lat while keeping the current altitude. */
  rotateTo(lng: number, lat: number, options?: GlobeRotateOptions): void;
  /** Spin the globe continuously around its vertical axis. */
  startAutoRotate(options?: GlobeAutoRotateOptions): void;
  /** Stop continuous spin started by {@link startAutoRotate}. */
  stopAutoRotate(): void;
  /** Current camera focus point on the globe surface. */
  getView(): GlobeView;
}

export interface CartoonPlanetProps {
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  /** Available planet maps (defaults to built-in Earth + Moon). */
  maps?: PlanetMapDefinition[];
  /** Available render modes (defaults to built-in Solid/Dots/Hybrid/Cyber). */
  renderModes?: GlobeRenderModeDefinition[];
  /** Toggle built-in UI pieces. Ignored when composable `children` are provided. All off by default. */
  ui?: Partial<CartoonPlanetUiOptions>;
  initialState?: CartoonPlanetInitialState;
  onReady?: (controller: CartoonPlanetController) => void;
  onStateChange?: (state: GlobeState) => void;
  /** Composable HUD and control panels rendered inside the globe viewport. */
  children?: React.ReactNode;
}

export interface ContinentRing {
  points?: [number, number][];
  outline?: boolean;
}

export interface Continent {
  name: string;
  color: string;
  outline?: boolean;
  rings: ([number, number][] | ContinentRing)[];
}

export interface PlanetMapOptions {
  oceanColor: string;
  landColor: string;
  atmosphereColor: string;
  atmosphereStrength: number;
  label?: string;
}

export const DEFAULT_UI_OPTIONS: CartoonPlanetUiOptions = {
  altitudeHud: false,
  scaleBar: false,
  fpsHud: false,
  markerLabels: false,
  hint: false,
  placingToast: false,
  startLevelControl: false,
  planetMapControl: false,
  renderModeControl: false,
  quickJumpControl: false,
  markerManagerControl: false,
};

export const DEFAULT_MARKERS: Marker[] = [
  { id: 'nyc', label: 'New York', lng: -74.006, lat: 40.7128, shape: 'orb', color: '#ff6b5f', size: 0.024 },
  { id: 'london', label: 'London cube', lng: -0.1276, lat: 51.5072, shape: 'cube', color: '#f3ead2', size: 0.026 },
  { id: 'tokyo', label: 'Tokyo tower', lng: 139.6917, lat: 35.6895, shape: 'bar', color: '#39ffd7', size: 0.02, height: 0.07 },
  { id: 'sydney', label: 'Sydney orb', lng: 151.2093, lat: -33.8688, shape: 'orb', color: '#b36cff', size: 0.023 },
];
