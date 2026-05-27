import type { RefObject } from 'react';
import { MapCatalog } from './catalog/mapCatalog';
import { RenderCatalog } from './catalog/renderCatalog';
import type {
  CartoonPlanetInitialState,
  GlobeEnginePort,
  GlobeRenderModeDefinition,
  GlobeState,
  Marker,
  MarkerShape,
  PlanetMapDefinition,
  StartViewId,
} from './types';
import { DEFAULT_MARKERS } from './types';

const PLANET_MAP_KEY = 'cartoonPlanetMap';
const RENDER_MODE_KEY = 'cartoonPlanetRenderMode';

export const START_VIEWS = {
  globe: { lng: 0, lat: 20, alt_m: 14_000_000 },
  ground: { lng: 0, lat: 20, alt_m: 1_500 },
} as const;

export const EARTH_RADIUS_M = 6_371_000;

export type GlobeControllerOptions = {
  initialState?: CartoonPlanetInitialState;
  maps: PlanetMapDefinition[];
  renderModes: GlobeRenderModeDefinition[];
};

class GlobeStateStore {
  state: GlobeState;
  private listeners = new Set<(state: GlobeState) => void>();

  constructor(initialState: Partial<GlobeState> = {}) {
    this.state = {
      renderMode: '',
      planetMap: '',
      startView: 'globe',
      markers: DEFAULT_MARKERS,
      placingMode: false,
      hud: { altitude: 0, scaleLabel: '0 m', focusLat: 0, focusLng: 0, scaleBarPx: 40, scaleBarLabel: '0 m' },
      fps: 0,
      markerLabels: [],
      linksEnabled: true,
      ...initialState,
    };
  }

  getState() {
    return this.state;
  }

  setState(nextStateOrFn: Partial<GlobeState> | ((state: GlobeState) => Partial<GlobeState>)) {
    const nextState = typeof nextStateOrFn === 'function' ? nextStateOrFn(this.state) : nextStateOrFn;
    this.state = { ...this.state, ...nextState };
    this.notify();
  }

  subscribe(listener: (state: GlobeState) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.state);
      } catch (e) {
        console.error('GlobeStateStore subscriber error', e);
      }
    });
  }
}

export class GlobeController {
  readonly mapCatalog: MapCatalog;
  readonly renderCatalog: RenderCatalog;

  constructor(
    private store: GlobeStateStore,
    private enginePortRef: RefObject<GlobeEnginePort>,
    mapCatalog: MapCatalog,
    renderCatalog: RenderCatalog
  ) {
    this.mapCatalog = mapCatalog;
    this.renderCatalog = renderCatalog;
  }

  getState() {
    return this.store.getState();
  }

  subscribe(listener: (state: GlobeState) => void) {
    return this.store.subscribe(listener);
  }

  getMaps() {
    return this.mapCatalog.getAll();
  }

  getRenderModes() {
    return this.renderCatalog.getAll();
  }

  setRenderMode(mode: GlobeRenderModeDefinition | string) {
    const name = typeof mode === 'string' ? mode : mode.name;
    if (!this.renderCatalog.get(name)) return;
    if (typeof mode !== 'string') {
      this.renderCatalog.register(mode);
    }
    this.renderCatalog.setActiveName(name);
    this.store.setState({ renderMode: name });
    try {
      localStorage.setItem(RENDER_MODE_KEY, name);
    } catch {
      /* ignore */
    }
    this.enginePortRef.current?.setRenderMode?.(name);
  }

  setPlanetMap(map: PlanetMapDefinition | string) {
    const name = typeof map === 'string' ? map : map.name;
    if (typeof map !== 'string') {
      this.mapCatalog.register(map);
    }
    if (!this.mapCatalog.get(name)) return;
    this.store.setState({ planetMap: name });
    try {
      localStorage.setItem(PLANET_MAP_KEY, name);
    } catch {
      /* ignore */
    }
    void this.mapCatalog.setActive(name).then(() => {
      this.enginePortRef.current?.rebuildPlanetMap?.();
    });
  }

  setStartView(view: StartViewId) {
    this.store.setState({ startView: view });
    try {
      localStorage.setItem('cartoonPlanetStartView', view);
    } catch {
      /* ignore */
    }
    const start = START_VIEWS[view];
    if (start) {
      this.flyTo(start.lng, start.lat, start.alt_m);
    }
  }

  setMarkers(list: Marker[]) {
    const markers = Array.isArray(list) ? list : [];
    this.store.setState({ markers });
    this.enginePortRef.current?.setMarkers?.(markers);
  }

  addMarker(
    label: string,
    lat: number,
    lng: number,
    shape: MarkerShape = 'orb',
    color = '#ff5e3a',
    size = 0.024,
    isOrbital = false,
    altitude = 1.18,
    orbitNodeA = '',
    orbitNodeB = ''
  ): Marker {
    const newMarker: Marker = {
      id: 'custom_' + Date.now(),
      label: label || `Marker at ${lat.toFixed(1)}, ${lng.toFixed(1)}°`,
      lng: Number(lng),
      lat: Number(lat),
      shape,
      color,
      size: Number(size),
      isOrbital: !!isOrbital,
      altitude: Number(altitude),
      orbitNodeA,
      orbitNodeB,
    };
    this.setMarkers([...this.store.getState().markers, newMarker]);
    return newMarker;
  }

  removeMarker(id: string) {
    this.setMarkers(this.store.getState().markers.filter((m) => m.id !== id));
  }

  setLinksEnabled(enabled: boolean) {
    this.store.setState({ linksEnabled: !!enabled });
    this.enginePortRef.current?.setMarkers?.(this.store.getState().markers);
  }

  startPlacing() {
    this.store.setState({ placingMode: true });
  }

  cancelPlacing() {
    this.store.setState({ placingMode: false });
  }

  flyTo(lng: number, lat: number, alt_m: number) {
    const r = 1 + alt_m / EARTH_RADIUS_M;
    this.enginePortRef.current?.controls?.flyTo(lng, lat, r, 1800);
  }

  flyToMarker(id: string) {
    const marker = this.store.getState().markers.find((m) => m.id === id);
    if (marker) {
      this.flyTo(marker.lng, marker.lat, 1500);
    }
  }

  updateHUD(hudData: GlobeState['hud']) {
    this.store.setState({ hud: hudData });
  }

  updateMarkerLabels(labels: GlobeState['markerLabels']) {
    this.store.setState({ markerLabels: labels });
  }

  updateFps(fps: number) {
    this.store.setState({ fps });
  }
}

function mergeUniqueMaps(maps: PlanetMapDefinition[], extra?: PlanetMapDefinition): PlanetMapDefinition[] {
  const list = [...maps];
  if (extra && !list.some((m) => m.name === extra.name)) {
    list.push(extra);
  }
  return list;
}

function mergeUniqueRenderModes(
  modes: GlobeRenderModeDefinition[],
  extra?: GlobeRenderModeDefinition
): GlobeRenderModeDefinition[] {
  const list = [...modes];
  if (extra && !list.some((m) => m.name === extra.name)) {
    list.push(extra);
  }
  return list;
}

export function createGlobeController(
  enginePortRef: RefObject<GlobeEnginePort>,
  options: GlobeControllerOptions
): GlobeController {
  const { initialState, maps, renderModes } = options;

  const resolvedMaps = mergeUniqueMaps(maps, initialState?.map);
  const resolvedRenderModes = mergeUniqueRenderModes(renderModes, initialState?.renderMode);

  const defaultMapName = (() => {
    try {
      const stored = localStorage.getItem(PLANET_MAP_KEY);
      if (stored && resolvedMaps.some((m) => m.name === stored)) return stored;
    } catch {
      /* ignore */
    }
    return initialState?.map?.name || resolvedMaps[0]?.name || '';
  })();

  const defaultRenderModeName = (() => {
    try {
      const stored = localStorage.getItem(RENDER_MODE_KEY);
      if (stored && resolvedRenderModes.some((m) => m.name === stored)) return stored;
    } catch {
      /* ignore */
    }
    return initialState?.renderMode?.name || resolvedRenderModes[0]?.name || '';
  })();

  const startView = (() => {
    try {
      if (initialState?.startView) return initialState.startView;
      return localStorage.getItem('cartoonPlanetStartView') === 'ground' ? 'ground' : 'globe';
    } catch {
      return 'globe';
    }
  })();

  const mapCatalog = new MapCatalog(resolvedMaps, defaultMapName);
  const renderCatalog = new RenderCatalog(resolvedRenderModes, defaultRenderModeName);

  const store = new GlobeStateStore({
    renderMode: defaultRenderModeName,
    planetMap: defaultMapName,
    startView,
    markers: initialState?.markers ?? DEFAULT_MARKERS,
    linksEnabled: initialState?.linksEnabled,
  });

  return new GlobeController(store, enginePortRef, mapCatalog, renderCatalog);
}
