import type { PlanetMapDefinition } from '../types';
import earthLandUrl from '../assets/earth-land.geojson?url';
import moonMariaUrl from '../assets/moon-maria.geojson?url';

/** Resolve bundled asset paths relative to this module (not the page URL). */
export function resolveBundledAssetUrl(assetPath: string): string {
  const cleanPath = assetPath.replace(/\?url$/, '');
  // Metro / Expo web bundles are not ES modules — `import.meta` crashes at runtime.
  // Vite/webpack consumers get absolute URLs from ?url imports before this runs.
  // RN/Expo apps should override `map.url` (see Critterboard CartoonPlanetGlobe).
  if (
    cleanPath.startsWith('http://') ||
    cleanPath.startsWith('https://') ||
    cleanPath.startsWith('file://') ||
    cleanPath.startsWith('/')
  ) {
    return cleanPath;
  }
  return cleanPath;
}

export const EARTH_MAP: PlanetMapDefinition = {
  name: 'Earth',
  url: resolveBundledAssetUrl(earthLandUrl),
  oceanColor: '#1f5fea',
  landColor: '#3aa94e',
  atmosphereColor: '#73b3ff',
  atmosphereStrength: 1,
  clouds: true,
  nightLights: true,
};

export const MOON_MAP: PlanetMapDefinition = {
  name: 'Moon',
  url: resolveBundledAssetUrl(moonMariaUrl),
  oceanColor: '#c4c4cc',
  landColor: '#4a4a58',
  atmosphereColor: '#888899',
  atmosphereStrength: 0.08,
};

export const BUILTIN_MAPS: PlanetMapDefinition[] = [EARTH_MAP, MOON_MAP];
