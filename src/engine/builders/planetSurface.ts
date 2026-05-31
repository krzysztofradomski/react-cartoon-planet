import type { RenderCatalog } from '../../catalog/renderCatalog';
import type { Continent, PlanetMapOptions } from '../../types';

export function buildPlanetSurface(
  renderCatalog: RenderCatalog,
  modeName: string,
  continents: Continent[] = [],
  outlinePx = 12,
  mapOptions: PlanetMapOptions & { name: string },
  options: { fatOutline?: boolean } = {}
) {
  return renderCatalog.build(modeName, continents, mapOptions, {
    outlinePx,
    fatOutline: options.fatOutline,
  });
}
