import type { Continent, GlobeLayerBuilder, PlanetMapDefinition, PlanetMapOptions } from '../types';

const LAND_COLOR = '#3aa94e';

const LOADING_FALLBACK: Continent[] = [{
  name: 'World (loading…)',
  color: LAND_COLOR,
  rings: [[[-170, 70], [170, 70], [170, -60], [-170, -60]]],
}];

interface MapEntry {
  name: string;
  url: string;
  oceanColor: string;
  landColor: string;
  atmosphereColor: string;
  atmosphereStrength: number;
  clouds: boolean | GlobeLayerBuilder;
  nightLights: boolean | GlobeLayerBuilder;
  continents: Continent[] | null;
  _loaded: boolean;
}

type MapChangeListener = (map: MapEntry) => void;

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

export function flattenGeoJsonToContinents(
  geo: { features: Parameters<typeof ringsOf>[0][] },
  landColor = LAND_COLOR
): Continent[] {
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

async function loadGeoJsonFromUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while loading ${url}`);
  }
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${url}, got ${text.slice(0, 40).replace(/\s+/g, ' ')}…`);
  }
}

export class MapCatalog {
  private _maps = new Map<string, MapEntry>();
  private _activeName: string;
  private _listeners: MapChangeListener[] = [];
  private _continents: Continent[] = LOADING_FALLBACK;

  constructor(maps: PlanetMapDefinition[], activeName?: string) {
    for (const def of maps) {
      this.register(def);
    }
    const first = maps[0]?.name;
    this._activeName = activeName && this._maps.has(activeName) ? activeName : first || '';
    const initial = this.getActive();
    this._continents = initial?.continents || LOADING_FALLBACK;
  }

  register(def: PlanetMapDefinition) {
    if (!def.name || !def.url) {
      console.error('MapCatalog: name and url are required');
      return;
    }
    this._maps.set(def.name, {
      ...def,
      oceanColor: def.oceanColor ?? '#1f5fea',
      landColor: def.landColor ?? LAND_COLOR,
      atmosphereColor: def.atmosphereColor ?? '#73b3ff',
      atmosphereStrength: def.atmosphereStrength ?? 1,
      clouds: def.clouds ?? false,
      nightLights: def.nightLights ?? false,
      continents: def.continents ?? null,
      _loaded: !!def.continents,
    });
  }

  get(name: string) {
    return this._maps.get(name);
  }

  getAll(): PlanetMapDefinition[] {
    return Array.from(this._maps.values()).map(
      ({ name, url, oceanColor, landColor, atmosphereColor, atmosphereStrength, clouds, nightLights }) => ({
        name,
        url,
        oceanColor,
        landColor,
        atmosphereColor,
        atmosphereStrength,
        clouds,
        nightLights,
      })
    );
  }

  getActive() {
    return this.get(this._activeName) || this._maps.values().next().value;
  }

  getActiveName() {
    return this._activeName;
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
      oceanColor: map.oceanColor!,
      landColor: map.landColor!,
      atmosphereColor: map.atmosphereColor!,
      atmosphereStrength: map.atmosphereStrength!,
      clouds: map.clouds ?? false,
      nightLights: map.nightLights ?? false,
      label: map.name,
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
        console.error('MapCatalog listener error', e);
      }
    }
  }

  setActiveName(name: string) {
    if (!this._maps.has(name)) return false;
    this._activeName = name;
    const initial = this.getActive();
    this._continents = initial?.continents || LOADING_FALLBACK;
    return true;
  }

  async setActive(name: string) {
    if (!this.setActiveName(name)) return false;
    await this.loadActive();
    this._continents = this.getContinents();
    this._notify();
    return true;
  }

  async loadActive() {
    const map = this.getActive();
    if (!map) return [];
    if (!map._loaded) {
      const geo = await loadGeoJsonFromUrl(map.url);
      const continents = flattenGeoJsonToContinents(geo, map.landColor);
      map.continents = continents;
      map._loaded = true;
      if (map.name === this._activeName) {
        this._continents = continents;
        this._notify();
      }
      return continents;
    }
    return map.continents || [];
  }
}
