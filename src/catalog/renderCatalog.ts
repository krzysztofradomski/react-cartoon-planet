import { Group } from 'three';
import type { Continent, GlobeRenderConfig, GlobeRenderModeDefinition, PlanetMapOptions } from '../types';

export class RenderCatalog {
  private _modes = new Map<string, GlobeRenderModeDefinition>();
  private _activeName: string;

  constructor(modes: GlobeRenderModeDefinition[], activeName?: string) {
    for (const mode of modes) {
      this.register(mode);
    }
    const first = modes[0]?.name;
    this._activeName = activeName && this._modes.has(activeName) ? activeName : first || '';
  }

  register(mode: GlobeRenderModeDefinition) {
    if (!mode.name || typeof mode.renderFunction !== 'function') {
      console.error("RenderCatalog: 'name' and 'renderFunction' are required.");
      return;
    }
    this._modes.set(mode.name, mode);
  }

  get(name: string) {
    return this._modes.get(name);
  }

  getAll(): GlobeRenderModeDefinition[] {
    return Array.from(this._modes.values());
  }

  getActiveName() {
    return this._activeName;
  }

  getActive() {
    return this.get(this._activeName) || this._modes.values().next().value;
  }

  setActiveName(name: string) {
    if (!this._modes.has(name)) return false;
    this._activeName = name;
    return true;
  }

  build(
    modeName: string,
    continents: Continent[],
    mapOptions: PlanetMapOptions & { name: string },
    options: { outlinePx?: number; fatOutline?: boolean; altitude?: number; time?: number } = {}
  ): Group {
    const mode = this.get(modeName) || this.getActive();
    if (!mode) return new Group();
    const config: GlobeRenderConfig = {
      continents,
      map: mapOptions,
      outlinePx: options.outlinePx ?? 12,
      fatOutline: !!options.fatOutline,
      altitude: options.altitude ?? 0,
      time: options.time ?? performance.now(),
    };
    const group = mode.renderFunction(config);
    group.userData.mode = mode.name;
    return group;
  }

  animate(modeName: string, group: Group, context: { alt: number; time: number }) {
    const mode = this.get(modeName);
    mode?.animate?.(group, context);
  }
}
