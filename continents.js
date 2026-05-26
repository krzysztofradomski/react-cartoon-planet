// Real continent shapes — loaded from Natural Earth's public-domain 1:110m
// physical land dataset. Each "continent" exposes a list of polygon rings in
// [lng, lat]. Inner rings are filled as land, without outlines, to remove lakes
// and other punched-out water shapes from the cartoon view.
//
// While the data is loading we expose a tiny cartoon fallback so the renderer
// has SOMETHING to draw on first paint. `window.loadRealContinents()` returns
// a Promise that resolves to the real array once the GeoJSON has been parsed.

(function () {
    // Single cartoon-green palette for ALL land (critter-board style).
    const LAND_COLOR = "#3aa94e";
  
    // -- Fallback cartoon shape (used until real data arrives) ---------------
    window.CONTINENTS = [{
      name: "World (loading…)",
      color: LAND_COLOR,
      rings: [[[-170, 70], [170, 70], [170, -60], [-170, -60]]]
    }];
  
    // -- GeoJSON loader ------------------------------------------------------
    // Natural Earth 1:110m LAND — a single continuous landmass per continent,
    // no country borders, no lakes carved out. Exactly what we want for the
    // cartoon look.
    const SOURCES = [
      "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_land.geojson",
      "https://cdn.jsdelivr.net/gh/martynafford/natural-earth-geojson@master/110m/physical/ne_110m_land.json",
      "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson"
    ];
  
    async function fetchFirst(urls) {
      let lastErr;
      for (const u of urls) {
        try {
          const r = await fetch(u);
          if (r.ok) return await r.json();
          lastErr = new Error("HTTP " + r.status + " from " + u);
        } catch (e) { lastErr = e; }
      }
      throw lastErr || new Error("no sources");
    }
  
    // Extract every ring of every polygon in a feature. Inner rings are marked
    // as no-outline lake fills so the renderer paints them green cleanly.
    function ringsOf(feature) {
      const g = feature.geometry;
      if (!g) return [];
      if (g.type === "Polygon") {
        return g.coordinates.map((ring, index) => ({ ring, outline: index === 0 }));
      }
      if (g.type === "MultiPolygon") {
        return g.coordinates.flatMap(poly =>
          poly.map((ring, index) => ({ ring, outline: index === 0 }))
        );
      }
      return [];
    }
  
    // Unwrap a polygon's longitudes so consecutive vertices never jump more
    // than 180°. This handles antimeridian-crossing rings (Russia, Fiji, USA
    // including Aleutians) without splitting: lngLatToVec3 is periodic in
    // longitude, so a ring spanning e.g. 170°…200° projects onto the sphere
    // identically to one spanning 170°…-160°. Earcut triangulates in 2D and
    // never sees the seam.
    function unwrapRing(ring) {
      if (ring.length < 2) return ring;
      const out = [ring[0].slice()];
      for (let i = 1; i < ring.length; i++) {
        const prev = out[i - 1];
        let lng = ring[i][0];
        const lat = ring[i][1];
        while (lng - prev[0] >  180) lng -= 360;
        while (lng - prev[0] < -180) lng += 360;
        out.push([lng, lat]);
      }
      return out;
    }
  
    // Each land polygon → its own "continent" object so the renderer can
    // triangulate it independently (avoids earcut trying to swallow disjoint
    // landmasses as one polygon).
    function flattenLand(geo) {
      const list = [];
      for (const f of geo.features) {
        for (const item of ringsOf(f)) {
          if (item.ring.length < 3) continue;
          list.push({
            name: "land",
            color: LAND_COLOR,
            rings: [{
              points: unwrapRing(item.ring),
              outline: item.outline
            }]
          });
        }
      }
      return list;
    }
  
    window.loadRealContinents = async function loadRealContinents() {
      const geo = await fetchFirst(SOURCES);
      const continents = flattenLand(geo);
      window.CONTINENTS = continents;
      window.dispatchEvent(new CustomEvent("continents:loaded", { detail: continents }));
      return continents;
    };
  
    // Cities removed for critter-board styling.
    window.CITIES = [];
  })();
  
