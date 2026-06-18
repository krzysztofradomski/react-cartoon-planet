import type { Group, Scene, PerspectiveCamera, WebGLRenderer } from 'three';

export type StartViewId = 'globe' | 'ground';
export type MarkerShape = 'orb' | 'cube' | 'bar' | 'icon' | 'cluster';

/** Per-frame context passed to a layer's `userData.update` hook. */
export interface GlobeLayerUpdateContext {
  /** Camera altitude above the surface, in meters. */
  alt: number;
  /** `performance.now()` timestamp. */
  time: number;
  /** Shared sun direction (unit vector, world space); drives the day/night cycle. */
  sunDir: import('three').Vector3;
}

/** Build-time context passed to a {@link GlobeLayerBuilder}. */
export interface GlobeLayerContext {
  map: PlanetMapOptions & { name: string };
  continents: Continent[];
  pixelRatio: number;
  /** Shared sun direction; mutated in place every frame, safe to close over. */
  sunDir: import('three').Vector3;
}

/**
 * Custom sky-layer factory (clouds, city lights, …) — the layer counterpart of
 * a render mode's `renderFunction`. Return an Object3D built from the
 * package's re-exported `THREE` (unit sphere: surface ≈ radius 1.0). Attach
 * `userData.update = (ctx: GlobeLayerUpdateContext) => void` for per-frame
 * animation. The returned object is disposed when the map or mode changes.
 */
export type GlobeLayerBuilder = (context: GlobeLayerContext) => import('three').Object3D;

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
  /**
   * Cloud layer (shown when the render mode supports day/night): `true` for
   * the built-in drifting procedural clouds, or a {@link GlobeLayerBuilder}
   * to plug in your own generator.
   */
  clouds?: boolean | GlobeLayerBuilder;
  /**
   * Night-side city lights (shown when the render mode supports day/night):
   * `true` for the built-in warm land lights, or a {@link GlobeLayerBuilder}.
   */
  nightLights?: boolean | GlobeLayerBuilder;
}

/** Passed to custom renderFunction implementations. */
export interface GlobeRenderConfig {
  continents: Continent[];
  map: PlanetMapOptions & { name: string };
  outlinePx: number;
  /** Draw coastlines as bold screen-space "fat" lines instead of 1px GL lines. */
  fatOutline: boolean;
  altitude: number;
  time: number;
}

/** Fully customizable globe surface renderer. */
export interface GlobeRenderModeDefinition {
  name: string;
  renderFunction: (config: GlobeRenderConfig) => Group;
  getAtmosphereColor?: () => import('three').Color;
  getMarkerMode?: () => string;
  /**
   * Opt in to the day/night cycle: a slowly drifting terminator shadow, plus
   * cloud and city-light layers when the active map enables them.
   */
  getDayNight?: () => boolean;
  animate?: (group: Group, context: { alt: number; time: number }) => void;
}

/** Tuning for the optional bloom post-processing pass. */
export interface CartoonPlanetBloomOptions {
  /** Glow intensity. Default: 0.55. */
  strength?: number;
  /** Glow spread. Default: 0.5. */
  radius?: number;
  /** Luminance below which pixels don't bloom. Default: 0.12. */
  threshold?: number;
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
  /** Emoji or short label rendered as a billboard icon (shape defaults to icon). */
  icon?: string;
  /** Set on aggregated cluster markers at high altitude. */
  isCluster?: boolean;
  clusterCount?: number;
  memberIds?: string[];
  /** Altitude (m) that frames this cluster's members when flown to. */
  frameAltitudeM?: number;
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
  lng?: number;
  lat?: number;
  isCluster?: boolean;
  frameAltitudeM?: number;
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
  /** Bold (fat) vector coastlines vs. thin 1px lines. */
  fatOutlines: boolean;
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
  /** Initial camera position; overrides `startView` preset on first mount. */
  initialCamera?: { lng: number; lat: number; alt_m: number };
  markers?: Marker[];
  linksEnabled?: boolean;
  fatOutlines?: boolean;
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
  /** App-level marker click hook; return `false` to suppress the default fly-to. */
  onMarkerClick?: ((marker: Marker) => boolean | void) | null;
  /** Fires with the hovered marker, or `null` when the pointer leaves it. */
  onMarkerHover?: ((marker: Marker | null) => void) | null;
  controls?: GlobeControlsLike;
  setRenderMode?: (modeName: string) => void;
  rebuildPlanetMap?: () => void;
  setMarkers?: (markers: Marker[]) => void;
  setBloom?: (bloom: boolean | CartoonPlanetBloomOptions | null | undefined) => void;
  setDayNight?: (enabled: boolean) => void;
  setClouds?: (enabled: boolean) => void;
  three?: CartoonPlanetThree;
}

/**
 * Live Three.js objects backing the globe, for consumers who want to drop in
 * their own meshes, raycast, post-process, etc. Obtain via `controller.getThree()`,
 * the `onSceneReady` prop, or `useCartoonPlanet().controller.getThree()`.
 * The package also re-exports the `THREE` namespace it uses, so construct
 * objects from that to avoid duplicate-instance issues.
 */
export interface CartoonPlanetThree {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  /** The globe's orbit/zoom controls (GlobeControls instance). */
  controls: GlobeControlsLike;
  /** Root group holding the surface + markers; child of `scene`. */
  planet: Group;
  /** Group holding the textured surface and coastline lines. */
  surfaceGroup: Group;
  /** Group holding the current marker meshes. */
  markerRoot: Group;
  /** The current marker mesh group (rebuilt as markers/clustering change). */
  getMarkerGroup: () => Group | null;
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
  /** Fires when the Three.js scene is mounted, with the live Three.js objects. */
  onSceneReady?: (three: CartoonPlanetThree) => void;
  /**
   * Bloom post-processing (UnrealBloomPass). `true` for defaults, or pass
   * tuning options. Toggleable at runtime; additive modes like Cyber pop hard.
   */
  bloom?: boolean | CartoonPlanetBloomOptions;
  /**
   * Day/night cycle (drifting terminator shadow + night-side city lights) on
   * modes/maps that support it. Toggleable at runtime. Default: true.
   */
  dayNight?: boolean;
  /**
   * Animated cloud layer on maps that enable it (and modes that support
   * day/night). Toggleable at runtime. Default: true.
   */
  clouds?: boolean;
  /**
   * Fires when a marker (or cluster) is clicked, before the default fly-to.
   * Return `false` to suppress the default behavior.
   */
  onMarkerClick?: (marker: Marker) => boolean | void;
  /** Fires with the marker under the pointer, or `null` when it leaves. */
  onMarkerHover?: (marker: Marker | null) => void;
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
  clouds?: boolean | GlobeLayerBuilder;
  nightLights?: boolean | GlobeLayerBuilder;
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

/** Imaginary Warsaw landmarks within ~2 m of each other — for clustering / spread demos. */
export const WARSAW_LANDMARK_MARKERS: Marker[] = [
  {
    id: 'warsaw-whisper-palace',
    label: 'Whisper Palace',
    lng: 21.0122,
    lat: 52.2297,
    shape: 'bar',
    color: '#8e24aa',
    size: 0.03,
    height: 0.06,
  },
  {
    id: 'warsaw-glass-pier',
    label: 'Glass Pier',
    lng: 21.0122146,
    lat: 52.229709,
    shape: 'cube',
    color: '#00bcd4',
    size: 0.03,
  },
  {
    id: 'warsaw-pickle-tower',
    label: 'Pickle Tower',
    lng: 21.012205,
    lat: 52.229718,
    shape: 'bar',
    color: '#7cb342',
    size: 0.03,
    height: 0.05,
  },
];
