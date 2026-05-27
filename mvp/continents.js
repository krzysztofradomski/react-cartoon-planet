// Planet map data — pluggable geographic features for the cartoon globe.
//
// Register custom maps via `PlanetMapRegistry.register({ ... })` before the app
// loads, or set `window.CARTOON_PLANET_MAP = 'moon'` to pick a built-in preset.
//
// Each map exposes polygon rings in [lng, lat] (same format as Earth continents).
// Inner rings can set `outline: false` to punch out lakes/holes.

(function () {
  const LAND_COLOR = '#3aa94e';

  // -- Fallback cartoon shape (used until real Earth data arrives) ------------
  const EARTH_FALLBACK = [{
    name: 'World (loading…)',
    color: LAND_COLOR,
    rings: [[[-170, 70], [170, 70], [170, -60], [-170, -60]]]
  }];

  window.CONTINENTS = EARTH_FALLBACK;

  // ===========================================================================
  // Planet Map Registry
  // ===========================================================================
  const PlanetMapRegistry = {
    _maps: new Map(),
    _activeId: 'earth',
    _listeners: [],

    register(config) {
      if (!config.id) {
        console.error('PlanetMapRegistry: id is required');
        return;
      }
      const entry = {
        id: config.id,
        label: config.label || config.id,
        oceanColor: config.oceanColor || '#1f5fea',
        landColor: config.landColor || LAND_COLOR,
        atmosphereColor: config.atmosphereColor != null ? config.atmosphereColor : '#73b3ff',
        atmosphereStrength: config.atmosphereStrength != null ? config.atmosphereStrength : 1,
        continents: config.continents || null,
        load: config.load || null,
        _loaded: typeof config.load === 'function' ? false : true,
      };
      this._maps.set(config.id, entry);
      this._notify();
    },

    get(id) {
      return this._maps.get(id);
    },

    getAll() {
      return Array.from(this._maps.values());
    },

    getActive() {
      return this.get(this._activeId) || this.get('earth');
    },

    getActiveId() {
      return this._activeId;
    },

    getContinents() {
      const map = this.getActive();
      return (map && map.continents) || window.CONTINENTS || [];
    },

    getOptions() {
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
    },

    onChange(listener) {
      this._listeners.push(listener);
      return () => {
        this._listeners = this._listeners.filter(l => l !== listener);
      };
    },

    _notify() {
      for (const listener of this._listeners) {
        try { listener(this.getActive()); } catch (e) { console.error('PlanetMapRegistry listener error', e); }
      }
    },

    async setActive(id) {
      if (!this._maps.has(id)) return false;
      this._activeId = id;
      await this.loadActive();
      window.CONTINENTS = this.getContinents();
      window.dispatchEvent(new CustomEvent('planetmap:changed', { detail: this.getActive() }));
      this._notify();
      return true;
    },

    async loadActive() {
      const map = this.getActive();
      if (!map) return [];
      // If a loader exists, allow static `continents` as fallback but still
      // load the authoritative geometry exactly once.
      if (typeof map.load === 'function' && !map._loaded) {
        const continents = await map.load();
        map.continents = continents;
        map._loaded = true;
        if (map.id === this._activeId) window.CONTINENTS = continents;
        return continents;
      }
      return map.continents || [];
    },
  };

  window.PlanetMapRegistry = PlanetMapRegistry;

  // -- GeoJSON helpers (local geospatial files) -------------------------------
  const GEOSPATIAL_FILES = {
    earth: 'data/geospatial/earth-land.geojson',
    moon: 'data/geospatial/moon-maria.geojson',
  };

  async function loadGeoJsonFile(path) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error('HTTP ' + response.status + ' while loading ' + path);
    }
    return await response.json();
  }

  function ringsOf(feature) {
    const g = feature.geometry;
    if (!g) return [];
    if (g.type === 'Polygon') {
      return g.coordinates.map((ring, index) => ({ ring, outline: index === 0 }));
    }
    if (g.type === 'MultiPolygon') {
      return g.coordinates.flatMap(poly =>
        poly.map((ring, index) => ({ ring, outline: index === 0 }))
      );
    }
    return [];
  }

  function unwrapRing(ring) {
    if (ring.length < 2) return ring;
    const out = [ring[0].slice()];
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

  function flattenLand(geo, landColor = LAND_COLOR) {
    const list = [];
    for (const f of geo.features) {
      for (const item of ringsOf(f)) {
        if (item.ring.length < 3) continue;
        list.push({
          name: 'land',
          color: landColor,
          rings: [{
            points: unwrapRing(item.ring),
            outline: item.outline
          }]
        });
      }
    }
    return list;
  }

  async function loadEarthContinents() {
    const geo = await loadGeoJsonFile(GEOSPATIAL_FILES.earth);
    return flattenLand(geo);
  }

  async function loadMoonContinents() {
    const geo = await loadGeoJsonFile(GEOSPATIAL_FILES.moon);
    return flattenLand(geo, '#4a4a58');
  }

  window.loadRealContinents = async function loadRealContinents() {
    const continents = await loadEarthContinents();
    const earth = PlanetMapRegistry.get('earth');
    if (earth) {
      earth.continents = continents;
      earth._loaded = true;
    }
    window.CONTINENTS = continents;
    window.dispatchEvent(new CustomEvent('continents:loaded', { detail: continents }));
    return continents;
  };

  // -- Moon preset (cartoon maria) --------------------------------------------
  function ellipseRing(lng, lat, lngRadius, latRadius, segments = 28) {
    const ring = [];
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      ring.push([
        lng + Math.cos(a) * lngRadius,
        lat + Math.sin(a) * latRadius,
      ]);
    }
    return ring;
  }

  function buildMoonMaria() {
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
    return maria.map(m => ({
      name: m.name,
      color: MOON_MARIA_COLOR,
      rings: [ellipseRing(m.lng, m.lat, m.lngR, m.latR)],
    }));
  }

  // -- Built-in maps ----------------------------------------------------------
  PlanetMapRegistry.register({
    id: 'earth',
    label: 'Earth',
    oceanColor: '#1f5fea',
    landColor: LAND_COLOR,
    atmosphereColor: '#73b3ff',
    atmosphereStrength: 1,
    continents: EARTH_FALLBACK,
    load: loadEarthContinents,
  });

  PlanetMapRegistry.register({
    id: 'moon',
    label: 'Moon',
    oceanColor: '#c4c4cc',
    landColor: '#4a4a58',
    atmosphereColor: '#888899',
    atmosphereStrength: 0.08,
    continents: buildMoonMaria(),
    load: loadMoonContinents,
  });

  // Initial map — `window.CARTOON_PLANET_MAP = 'moon'` before scripts load
  const initialMapId = (typeof window.CARTOON_PLANET_MAP === 'string' && window.CARTOON_PLANET_MAP) || 'earth';
  if (PlanetMapRegistry.get(initialMapId)) {
    PlanetMapRegistry._activeId = initialMapId;
    const initial = PlanetMapRegistry.getActive();
    window.CONTINENTS = initial.continents || EARTH_FALLBACK;
  }

  window.CITIES = [];
})();
