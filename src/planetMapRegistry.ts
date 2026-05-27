import type { Continent, PlanetMapId, PlanetMapOptions } from './types';
import earthLandUrl from './assets/earth-land.geojson?url';
import moonMariaUrl from './assets/moon-maria.geojson?url';

const LAND_COLOR = '#3aa94e';

/** Resolve bundled asset paths relative to this module (not the page URL). */
function resolveAssetUrl(assetPath: string): string {
  const cleanPath = assetPath.replace(/\?url$/, '');
  return new URL(cleanPath, import.meta.url).href;
}

const EARTH_FALLBACK: Continent[] = [{
  name: 'World (loading…)',
  color: LAND_COLOR,
  rings: [[[-170, 70], [170, 70], [170, -60], [-170, -60]]],
}];

interface PlanetMapEntry {
  id: string;
  label: string;
  oceanColor: string;
  landColor: string;
  atmosphereColor: string;
  atmosphereStrength: number;
  continents: Continent[] | null;
  load?: (() => Promise<Continent[]>) | null;
  _loaded: boolean;
}

interface PlanetMapConfig {
  id: string;
  label?: string;
  oceanColor?: string;
  landColor?: string;
  atmosphereColor?: string | null;
  atmosphereStrength?: number | null;
  continents?: Continent[] | null;
  load?: (() => Promise<Continent[]>) | null;
}

type MapChangeListener = (map: PlanetMapEntry) => void;

class PlanetMapRegistryImpl {
  private _maps = new Map<string, PlanetMapEntry>();
  private _activeId: PlanetMapId = 'earth';
  private _listeners: MapChangeListener[] = [];
  private _continents: Continent[] = EARTH_FALLBACK;

  register(config: PlanetMapConfig) {
    if (!config.id) {
      console.error('PlanetMapRegistry: id is required');
      return;
    }
    const entry: PlanetMapEntry = {
      id: config.id,
      label: config.label || config.id,
      oceanColor: config.oceanColor || '#1f5fea',
      landColor: config.landColor || LAND_COLOR,
      atmosphereColor: config.atmosphereColor != null ? config.atmosphereColor : '#73b3ff',
      atmosphereStrength: config.atmosphereStrength != null ? config.atmosphereStrength : 1,
      continents: config.continents || null,
      load: config.load || null,
      _loaded: typeof config.load !== 'function',
    };
    this._maps.set(config.id, entry);
    this._notify();
  }

  get(id: string) {
    return this._maps.get(id);
  }

  getAll() {
    return Array.from(this._maps.values());
  }

  getActive() {
    return this.get(this._activeId) || this.get('earth');
  }

  getActiveId() {
    return this._activeId;
  }

  getContinents(): Continent[] {
    const map = this.getActive();
    return (map && map.continents) || this._continents || [];
  }

  getOptions(): PlanetMapOptions {
    const map = this.getActive();
    if (!map) {
      return { oceanColor: '#1f5fea', landColor: LAND_COLOR, atmosphereColor: '#73b3ff', atmosphereStrength: 1 };
    }
    return {
      oceanColor: map.oceanColor,
      landColor: map.landColor,
      atmosphereColor: map.atmosphereColor,
      atmosphereStrength: map.atmosphereStrength,
      label: map.label,
    };
  }

  onChange(listener: MapChangeListener) {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== listener);
    };
  }

  private _notify() {
    const active = this.getActive();
    if (!active) return;
    for (const listener of this._listeners) {
      try {
        listener(active);
      } catch (e) {
        console.error('PlanetMapRegistry listener error', e);
      }
    }
  }

  async setActive(id: PlanetMapId) {
    if (!this._maps.has(id)) return false;
    this._activeId = id;
    await this.loadActive();
    this._continents = this.getContinents();
    this._notify();
    return true;
  }

  async loadActive() {
    const map = this.getActive();
    if (!map) return [];
    if (typeof map.load === 'function' && !map._loaded) {
      const continents = await map.load();
      map.continents = continents;
      map._loaded = true;
      if (map.id === this._activeId) {
        this._continents = continents;
        this._notify();
      }
      return continents;
    }
    return map.continents || [];
  }

  setActiveId(id: PlanetMapId) {
    if (this._maps.has(id)) {
      this._activeId = id;
      const initial = this.getActive();
      this._continents = initial?.continents || EARTH_FALLBACK;
    }
  }
}

async function loadGeoJsonFile(path: string) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while loading ${path}`);
  }
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${path}, got ${text.slice(0, 40).replace(/\s+/g, ' ')}…`);
  }
}

function ringsOf(feature: { geometry?: { type: string; coordinates: unknown } }) {
  const g = feature.geometry;
  if (!g) return [] as { ring: number[][]; outline: boolean }[];
  const coords = g.coordinates as number[][][] | number[][][][];
  if (g.type === 'Polygon') {
    return coords.map((ring, index) => ({ ring: ring as number[][], outline: index === 0 }));
  }
  if (g.type === 'MultiPolygon') {
    return (coords as number[][][][]).flatMap((poly) =>
      poly.map((ring, index) => ({ ring, outline: index === 0 }))
    );
  }
  return [];
}

function unwrapRing(ring: number[][]) {
  if (ring.length < 2) return ring;
  const out: number[][] = [ring[0].slice()];
  for (let i = 1; i < ring.length; i++) {
    const prev = out[i - 1];
    let lng = ring[i][0];
    const lat = ring[i][1];
    while (lng - prev[0] > 180) lng -= 360;
    while (lng - prev[0] < -180) lng += 360;
    out.push([lng, lat]);
  }
  return out;
}

function flattenLand(geo: { features: Parameters<typeof ringsOf>[0][] }, landColor = LAND_COLOR): Continent[] {
  const list: Continent[] = [];
  for (const f of geo.features) {
    for (const item of ringsOf(f)) {
      if (item.ring.length < 3) continue;
      list.push({
        name: 'land',
        color: landColor,
        rings: [{ points: unwrapRing(item.ring) as [number, number][], outline: item.outline }],
      });
    }
  }
  return list;
}

async function loadEarthContinents() {
  const geo = await loadGeoJsonFile(resolveAssetUrl(earthLandUrl));
  return flattenLand(geo);
}

async function loadMoonContinents() {
  const geo = await loadGeoJsonFile(resolveAssetUrl(moonMariaUrl));
  return flattenLand(geo, '#4a4a58');
}

function ellipseRing(lng: number, lat: number, lngRadius: number, latRadius: number, segments = 28): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    ring.push([lng + Math.cos(a) * lngRadius, lat + Math.sin(a) * latRadius]);
  }
  return ring;
}

function buildMoonMaria(): Continent[] {
  const maria = [
    { name: 'Oceanus Procellarum', lng: -47, lat: 6, lngR: 30, latR: 16 },
    { name: 'Mare Imbrium', lng: -32, lat: 18, lngR: 18, latR: 14 },
    { name: 'Mare Serenitatis', lng: 18, lat: 24, lngR: 12, latR: 10 },
    { name: 'Mare Tranquillitatis', lng: 24, lat: 8, lngR: 14, latR: 9 },
    { name: 'Mare Crisium', lng: 58, lat: 17, lngR: 9, latR: 7 },
    { name: 'Mare Fecunditatis', lng: 52, lat: -6, lngR: 14, latR: 10 },
    { name: 'Mare Nubium', lng: -16, lat: -20, lngR: 12, latR: 9 },
    { name: 'Mare Humorum', lng: -38, lat: -24, lngR: 10, latR: 8 },
    { name: 'Mare Cognitum', lng: -28, lat: -10, lngR: 8, latR: 6 },
    { name: 'Mare Vaporum', lng: 4, lat: 13, lngR: 7, latR: 5 },
    { name: 'Mare Insularum', lng: -8, lat: 8, lngR: 6, latR: 5 },
    { name: 'Mare Australe', lng: 60, lat: -38, lngR: 11, latR: 8 },
    { name: 'Mare Orientale', lng: -92, lat: -20, lngR: 10, latR: 8 },
  ];
  const MOON_MARIA_COLOR = '#4a4a58';
  return maria.map((m) => ({
    name: m.name,
    color: MOON_MARIA_COLOR,
    rings: [ellipseRing(m.lng, m.lat, m.lngR, m.latR)],
  }));
}

export const planetMapRegistry = new PlanetMapRegistryImpl();

planetMapRegistry.register({
  id: 'earth',
  label: 'Earth',
  oceanColor: '#1f5fea',
  landColor: LAND_COLOR,
  atmosphereColor: '#73b3ff',
  atmosphereStrength: 1,
  continents: EARTH_FALLBACK,
  load: loadEarthContinents,
});

planetMapRegistry.register({
  id: 'moon',
  label: 'Moon',
  oceanColor: '#c4c4cc',
  landColor: '#4a4a58',
  atmosphereColor: '#888899',
  atmosphereStrength: 0.08,
  continents: buildMoonMaria(),
  load: loadMoonContinents,
});
