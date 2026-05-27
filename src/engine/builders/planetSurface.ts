/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { planetRenderRegistry as PlanetRenderRegistry } from '../planetRenderRegistry';

export function buildPlanetSurface(continents = [], outlinePx = 12, mode = 'surface', mapOptions = {}) {
  return PlanetRenderRegistry.build(mode, continents, { outlinePx, ...mapOptions });
}
