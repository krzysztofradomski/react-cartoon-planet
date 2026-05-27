import type { Continent, PlanetMapOptions } from '../types';
import { Group } from 'three';
import { planetMapRegistry } from '../planetMapRegistry';

export interface RenderMode {
  id: string;
  label: string;
  build: (continents: Continent[], options?: Record<string, unknown>) => Group;
  getAtmosphereColor?: () => import('three').Color;
  getMarkerMode?: () => string;
  animate?: (group: Group, context: { alt: number; time: number }) => void;
}

type RenderModeListener = () => void;

class PlanetRenderRegistryImpl {
  private _modes = new Map<string, RenderMode>();
  private _listeners: RenderModeListener[] = [];

  register(mode: RenderMode) {
    if (!mode.id || !mode.build) {
      console.error("Invalid render mode. 'id' and 'build()' are required.");
      return;
    }
    this._modes.set(mode.id, mode);
    this._notify();
  }

  get(id: string) {
    return this._modes.get(id);
  }

  getAll() {
    return Array.from(this._modes.values());
  }

  onChange(listener: RenderModeListener) {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== listener);
    };
  }

  private _notify() {
    for (const listener of this._listeners) {
      try {
        listener();
      } catch (e) {
        console.error('Listener error', e);
      }
    }
  }

  build(id: string, continents: Continent[], options: Record<string, unknown> = {}) {
    const mode = this.get(id) || this.get('surface');
    if (!mode) return new Group();
    const mapOptions = planetMapRegistry.getOptions();
    const group = mode.build(continents, { ...mapOptions, ...options });
    group.userData.mode = id;
    return group;
  }

  animate(id: string, group: Group, context: { alt: number; time: number }) {
    const mode = this.get(id);
    if (mode?.animate) {
      mode.animate(group, context);
    }
  }
}

export const planetRenderRegistry = new PlanetRenderRegistryImpl();

export type { PlanetMapOptions };
