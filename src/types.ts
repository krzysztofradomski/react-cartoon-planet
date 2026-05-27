export type PlanetMapId = 'earth' | 'moon' | string;
export type RenderModeId = 'surface' | 'dots' | 'hybrid' | 'cyberpunk' | string;
export type StartViewId = 'globe' | 'ground';
export type MarkerShape = 'orb' | 'cube' | 'bar';

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
  renderMode: RenderModeId;
  planetMap: PlanetMapId;
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
  map?: PlanetMapId;
  renderMode?: RenderModeId;
  startView?: StartViewId;
  markers?: Marker[];
  linksEnabled?: boolean;
}

export interface GlobeControlsLike {
  flyTo(lng: number, lat: number, radius: number, duration?: number): void;
}

export interface GlobeEnginePort {
  isPlacingMode?: boolean;
  onGlobeClick?: ((lng: number, lat: number) => void) | null;
  controls?: GlobeControlsLike;
  setRenderMode?: (mode: RenderModeId) => void;
  rebuildPlanetMap?: () => void;
  setMarkers?: (markers: Marker[]) => void;
}

/** @deprecated Use GlobeEnginePort */
export type GlobeRuntimeRef = GlobeEnginePort;

export interface CartoonPlanetController {
  getState(): GlobeState;
  subscribe(listener: (state: GlobeState) => void): () => void;
  setRenderMode(mode: RenderModeId): void;
  setPlanetMap(mapId: PlanetMapId): void;
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
  flyTo(lng: number, lat: number, altitudeMeters: number): void;
  flyToMarker(id: string): void;
}

export interface CartoonPlanetProps {
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  ui?: Partial<CartoonPlanetUiOptions>;
  initialState?: CartoonPlanetInitialState;
  onReady?: (controller: CartoonPlanetController) => void;
  onStateChange?: (state: GlobeState) => void;
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
  altitudeHud: true,
  scaleBar: true,
  fpsHud: true,
  markerLabels: true,
  hint: true,
  placingToast: true,
  startLevelControl: true,
  planetMapControl: true,
  renderModeControl: true,
  quickJumpControl: true,
  markerManagerControl: true,
};

export const DEFAULT_MARKERS: Marker[] = [
  { id: 'nyc', label: 'New York', lng: -74.006, lat: 40.7128, shape: 'orb', color: '#ff6b5f', size: 0.024 },
  { id: 'london', label: 'London cube', lng: -0.1276, lat: 51.5072, shape: 'cube', color: '#f3ead2', size: 0.026 },
  { id: 'tokyo', label: 'Tokyo tower', lng: 139.6917, lat: 35.6895, shape: 'bar', color: '#39ffd7', size: 0.02, height: 0.07 },
  { id: 'sydney', label: 'Sydney orb', lng: 151.2093, lat: -33.8688, shape: 'orb', color: '#b36cff', size: 0.023 },
];
