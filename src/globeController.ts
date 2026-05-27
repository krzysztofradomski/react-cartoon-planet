import type { RefObject } from 'react';
import { planetMapRegistry } from './planetMapRegistry';
import { planetRenderRegistry } from './engine/planetRenderRegistry';
import type {
  CartoonPlanetInitialState,
  GlobeEnginePort,
  GlobeState,
  Marker,
  MarkerShape,
  PlanetMapId,
  RenderModeId,
  StartViewId,
} from './types';
import { DEFAULT_MARKERS } from './types';

const PLANET_MAP_KEY = 'cartoonPlanetMap';

export const START_VIEWS = {
  globe: { lng: 0, lat: 20, alt_m: 14_000_000 },
  ground: { lng: 0, lat: 20, alt_m: 1_500 },
} as const;

export const EARTH_RADIUS_M = 6_371_000;

class GlobeStateStore {
  state: GlobeState;
  private listeners = new Set<(state: GlobeState) => void>();

  constructor(initialState: Partial<GlobeState> = {}) {
    this.state = {
      renderMode: 'surface',
      planetMap: 'earth',
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
  constructor(
    private store: GlobeStateStore,
    private enginePortRef: RefObject<GlobeEnginePort>
  ) {}

  getState() {
    return this.store.getState();
  }

  subscribe(listener: (state: GlobeState) => void) {
    return this.store.subscribe(listener);
  }

  setRenderMode(mode: RenderModeId) {
    if (!planetRenderRegistry.get(mode)) return;
    this.store.setState({ renderMode: mode });
    try {
      localStorage.setItem('cartoonPlanetRenderMode', mode);
    } catch {
      /* ignore */
    }
    if (this.enginePortRef.current?.setRenderMode) {
      this.enginePortRef.current.setRenderMode(mode);
    }
  }

  setPlanetMap(mapId: PlanetMapId) {
    if (!planetMapRegistry.get(mapId)) return;
    this.store.setState({ planetMap: mapId });
    try {
      localStorage.setItem(PLANET_MAP_KEY, mapId);
    } catch {
      /* ignore */
    }
    void planetMapRegistry.setActive(mapId).then(() => {
      if (this.enginePortRef.current?.rebuildPlanetMap) {
        this.enginePortRef.current.rebuildPlanetMap();
      }
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
    if (this.enginePortRef.current?.setMarkers) {
      this.enginePortRef.current.setMarkers(markers);
    }
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
      label: label || `Marker at ${lat.toFixed(1)}°, ${lng.toFixed(1)}°`,
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
    if (this.enginePortRef.current?.setMarkers) {
      this.enginePortRef.current.setMarkers(this.store.getState().markers);
    }
  }

  startPlacing() {
    this.store.setState({ placingMode: true });
  }

  cancelPlacing() {
    this.store.setState({ placingMode: false });
  }

  flyTo(lng: number, lat: number, alt_m: number) {
    const r = 1 + alt_m / EARTH_RADIUS_M;
    if (this.enginePortRef.current?.controls) {
      this.enginePortRef.current.controls.flyTo(lng, lat, r, 1800);
    }
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

export function createGlobeController(
  enginePortRef: RefObject<GlobeEnginePort>,
  initialState?: CartoonPlanetInitialState
): GlobeController {
  const renderMode = (() => {
    try {
      const stored = localStorage.getItem('cartoonPlanetRenderMode');
      return stored && planetRenderRegistry.get(stored) ? stored : 'surface';
    } catch {
      return 'surface';
    }
  })();

  const planetMap = (() => {
    try {
      const fromProp = initialState?.map ?? null;
      const stored = localStorage.getItem(PLANET_MAP_KEY) || fromProp;
      return stored && planetMapRegistry.get(stored) ? stored : planetMapRegistry.getActiveId() || 'earth';
    } catch {
      return 'earth';
    }
  })();

  const startView = (() => {
    try {
      if (initialState?.startView) return initialState.startView;
      return localStorage.getItem('cartoonPlanetStartView') === 'ground' ? 'ground' : 'globe';
    } catch {
      return 'globe';
    }
  })();

  if (initialState?.map && planetMapRegistry.get(initialState.map)) {
    planetMapRegistry.setActiveId(initialState.map);
  } else if (planetMapRegistry.get(planetMap)) {
    planetMapRegistry.setActiveId(planetMap);
  }

  const store = new GlobeStateStore({
    renderMode: initialState?.renderMode || renderMode,
    planetMap: initialState?.map || planetMap,
    startView: initialState?.startView || startView,
    markers: initialState?.markers ?? DEFAULT_MARKERS,
    linksEnabled: initialState?.linksEnabled,
  });

  return new GlobeController(store, enginePortRef);
}
