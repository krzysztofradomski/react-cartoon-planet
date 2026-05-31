# react-cartoon-planet

Animated cartoon globe for React — zoom from orbit to ground level, switch visual styles, drop markers, and drive the camera from your own UI.

<video src="https://raw.githubusercontent.com/krzysztofradomski/react-cartoon-planet/refs/heads/main/media/demo.mp4" width="100%" autoplay loop muted playsinline></video>

## Install

```bash
npm install react-cartoon-planet three
# or
pnpm add react-cartoon-planet three
```

**Peer dependencies** (you install these):

- `react` (18 or 19)
- `react-dom`
- [`three`](https://threejs.org/) (`>=0.160`) — WebGL scene, globe mesh, markers, custom render modes

`three` is a **peer** so your app and the globe share one Three.js instance — that's what makes `controller.getThree()` objects, `instanceof` checks, and the re-exported `THREE` all line up. Construct your own meshes from the package's re-exported `THREE` (see [Direct Three.js access](#direct-threejs-access)).

**Dependencies** (installed automatically with the package):

- [`earcut`](https://github.com/mapbox/earcut) — polygon triangulation for continent geometry

Import the bundled stylesheet once in your app:

```ts
import "react-cartoon-planet/style.css";
```

## Quick start

Mount the globe, wire a ref for programmatic control, and compose the built-in HUD / sidebar controls as children:

```tsx
import { useRef, useState } from "react";
import "react-cartoon-planet/style.css";
import {
  AltitudeDisplay,
  BUILTIN_RENDER_MODES,
  CartoonPlanet,
  EARTH_MAP,
  FpsDisplay,
  HintDisplay,
  MarkerLabelsDisplay,
  MarkerManagerControl,
  MOON_MAP,
  OutlineStyleControl,
  PlanetMapControl,
  PlacingToastDisplay,
  QuickJumpControl,
  RenderModeControl,
  ScaleBarDisplay,
  StartLevelControl,
  START_VIEWS,
  SURFACE_RENDER_MODE,
} from "react-cartoon-planet";
import type { CartoonPlanetController, GlobeState } from "react-cartoon-planet";

export function GlobeDemo() {
  const controllerRef = useRef<CartoonPlanetController | null>(null);
  const [planetState, setPlanetState] = useState<GlobeState | null>(null);

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <header>
        <button
          onClick={() => controllerRef.current?.flyTo(-74.006, 40.7128, 1_500)}
        >
          Fly to NYC
        </button>
        <button
          onClick={() =>
            controllerRef.current?.flyTo(
              START_VIEWS.globe.lng,
              START_VIEWS.globe.lat,
              START_VIEWS.globe.alt_m,
              { duration: 900 }
            )
          }
        >
          Reset view
        </button>
      </header>

      <CartoonPlanet
        ref={controllerRef}
        maps={[EARTH_MAP, MOON_MAP]}
        renderModes={BUILTIN_RENDER_MODES}
        initialState={{
          map: EARTH_MAP,
          renderMode: SURFACE_RENDER_MODE,
          startView: "globe",
        }}
        onStateChange={setPlanetState}
      >
        <FpsDisplay />
        <AltitudeDisplay />
        <ScaleBarDisplay />
        <MarkerLabelsDisplay />
        <PlacingToastDisplay />
        <HintDisplay />
        <StartLevelControl />
        <PlanetMapControl />
        <RenderModeControl />
        <OutlineStyleControl />
        <QuickJumpControl />
        <MarkerManagerControl />
      </CartoonPlanet>

      <footer>
        lng {planetState?.hud.focusLng?.toFixed(2)}° · alt{" "}
        {planetState?.hud.scaleLabel}
      </footer>
    </div>
  );
}
```

Give the canvas room to breathe — the globe fills its container (`width` / `height: 100%` on a sized parent works well).

## Render modes

Four built-in styles ship out of the box. Switch them in the sidebar (`RenderModeControl`) or via `controller.setRenderMode("Cyber")`.

| Solid                                                                                                                              | Dots                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| ![Solid render mode](https://raw.githubusercontent.com/krzysztofradomski/react-cartoon-planet/refs/heads/main/media/solid-big.png) | ![Dots render mode](https://raw.githubusercontent.com/krzysztofradomski/react-cartoon-planet/refs/heads/main/media/dots-big.png) |

| Hybrid                                                                                                                               | Cyber                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| ![Hybrid render mode](https://raw.githubusercontent.com/krzysztofradomski/react-cartoon-planet/refs/heads/main/media/hybrid-big.png) | ![Cyber render mode](https://raw.githubusercontent.com/krzysztofradomski/react-cartoon-planet/refs/heads/main/media/cyber-big.png) |

Cyber mode in motion:

<video src="https://raw.githubusercontent.com/krzysztofradomski/react-cartoon-planet/refs/heads/main/media/cyber-short.mp4" width="100%" autoplay loop muted playsinline></video>

Presets: `SURFACE_RENDER_MODE` (Solid), `DOTS_RENDER_MODE`, `HYBRID_RENDER_MODE`, `CYBERPUNK_RENDER_MODE`, or the full `BUILTIN_RENDER_MODES` array.

## Coastlines

Continent borders render as **screen-space vector lines** (not a baked texture stroke), so they stay a crisp, constant thickness from orbit all the way to ground level instead of ballooning as you zoom in. Toggle bold vs. thin via `OutlineStyleControl`, `controller.setFatOutlines(boolean)`, or `initialState.fatOutlines`:

- **off** (default) — thin 1px lines: crisp and cheap to render.
- **on** — bold screen-space "fat" lines (~2.5px), DPR-independent (won't look hairline on HiDPI); a little heavier since each segment is a shaded quad.

## Markers

Markers are screen-constant **pins** anchored to the surface — readable from orbit and at ~5 m ground level alike. Supply them via `initialState.markers` or the controller's marker methods. Two sample sets ship: `DEFAULT_MARKERS` (cities) and `WARSAW_BUG_MARKERS` (three pests ~2 m apart, for the clustering demo).

- **Clustering** — at altitude, markers that would overlap on screen merge into a count badge (e.g. "3 pests"). Clicking a cluster flies down to an altitude that frames and separates its members.
- **Ground level** — keep zooming (down to ~5 m) to see individuals at their true coordinates.
- **Placement** — `startPlacing()` (or `MarkerManagerControl`) → click the globe to drop a marker exactly where the cursor lands. The built-in editor previews it live on the map (size, color, label, shape); **Save** finalizes, **Cancel** discards.
- **Links** — `setLinksEnabled(true)` draws arcs between markers; toggle in the UI with `LinksDisplay`.

## Planet maps

- **Earth** — `EARTH_MAP` (bundled GeoJSON, blue ocean / green land)
- **Moon** — `MOON_MAP` (bundled maria data)

Pass your own `PlanetMapDefinition` with a GeoJSON URL, or pre-parsed `continents` to skip the fetch. Use `flattenGeoJsonToContinents` if you already have GeoJSON in memory.

### Map data sources

Bundled land/maria geometry comes from third-party datasets. Full attribution, download URLs, and processing notes:

**[Geospatial data sources](https://github.com/krzysztofradomski/react-cartoon-planet/blob/main/mvp/data/geospatial/source.md)** (`mvp/data/geospatial/source.md`)

| File | Origin |
| --- | --- |
| `earth-land.geojson` | [Natural Earth](https://www.naturalearthdata.com/) `ne_110m_land` — [source GeoJSON](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson) (Public Domain) |
| `moon-maria.geojson` | [LROC Global Mare](https://pds.lroc.wisc.edu/) boundaries — converted from the official shapefile ZIP with `shpjs` |

## Controller API

Attach a ref (`useRef<CartoonPlanetController>()`) or use `onReady` to get the controller.

| Method                                      | Description                              |
| ------------------------------------------- | ---------------------------------------- |
| `flyTo(lng, lat, altitudeMeters, options?)` | Animated camera move (default 1800 ms)   |
| `flyToAltitude(altitudeMeters, options?)`   | Zoom in/out at current heading           |
| `flyToMarker(id)`                           | Fly to a marker by id                    |
| `rotateBy(lngDelta, latDelta, options?)`    | Nudge heading (default 600 ms)           |
| `rotateTo(lng, lat, options?)`              | Absolute heading at current altitude     |
| `startAutoRotate` / `stopAutoRotate`        | Continuous spin                          |
| `getView()`                                 | Current `{ lng, lat, altitudeMeters }`   |
| `setRenderMode(mode)`                       | Switch visual style (name or definition) |
| `setPlanetMap(map)`                         | Switch planet map                        |
| `setStartView("globe" \| "ground")`         | Orbit vs near-ground preset              |
| `setMarkers` / `addMarker` / `removeMarker` | Marker CRUD                              |
| `startPlacing` / `cancelPlacing`            | Click-to-place marker mode               |
| `setLinksEnabled(boolean)`                  | Toggle marker link lines                 |
| `setFatOutlines(boolean)`                   | Bold vs thin (1px) vector coastlines     |
| `getThree()`                                | Live Three.js objects (see below)        |
| `getState()` / `subscribe(listener)`        | Reactive globe state                     |

`onStateChange` on `<CartoonPlanet>` is the React-friendly alternative to `subscribe`.

## Composable UI

Sidebar panels and HUD widgets are optional React children — include only what you need:

| Component                | Role                           |
| ------------------------ | ------------------------------ |
| `FpsDisplay`             | Frame rate                     |
| `AltitudeDisplay`        | Current altitude               |
| `ScaleBarDisplay`        | Map scale bar                  |
| `MarkerLabelsDisplay`    | Screen-space marker labels     |
| `PlacingToastDisplay`    | “Click globe to place” hint    |
| `HintDisplay`            | Interaction hints              |
| `StartLevelControl`      | Globe / ground start level     |
| `PlanetMapControl`       | Earth / Moon (or custom maps)  |
| `RenderModeControl`      | Style picker                   |
| `OutlineStyleControl`    | Bold (fat) coastlines toggle   |
| `QuickJumpControl`       | Preset locations               |
| `MarkerManagerControl`   | Add / remove markers           |
| `LinksDisplay`           | Marker link-lines toggle       |
| `CartoonPlanetDefaultUi` | All of the above in one bundle |

If you pass `children`, the legacy `ui={{ … }}` prop is ignored. Without children, every built-in panel stays off unless you opt in via `ui`.

## Custom render modes

Implement `GlobeRenderModeDefinition` with a `renderFunction` that receives continent geometry and returns a **three.js** `Group`. Continent outlines are already triangulated (via **earcut**) in `config.continents` — your mode typically textures or stylizes that mesh.

Register modes in the `renderModes` prop or call `setRenderMode` with a new definition at runtime.

```ts
import * as THREE from "three";
import type { GlobeRenderModeDefinition } from "react-cartoon-planet";

const MY_MODE: GlobeRenderModeDefinition = {
  name: "MyStyle",
  renderFunction(config) {
    const group = new THREE.Group();
    // build from config.continents, config.map, config.outlinePx …
    return group;
  },
};
```

## Direct Three.js access

Need to drop your own meshes into the scene, raycast, add post-processing, or run a custom animation loop? The globe exposes its live Three.js objects via the `onSceneReady` prop (fires on mount) or `controller.getThree()` (returns `null` until mounted).

```tsx
import { CartoonPlanet, THREE } from "react-cartoon-planet";
import type { CartoonPlanetThree } from "react-cartoon-planet";

<CartoonPlanet
  onSceneReady={(three: CartoonPlanetThree) => {
    // Build from the package's THREE so it's the SAME instance the globe runs on.
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.25, 0.012, 12, 96),
      new THREE.MeshBasicMaterial({ color: "#ff2eea" })
    );
    ring.rotation.x = Math.PI / 2;
    three.scene.add(ring); // add to `three.planet` instead to move with the globe
  }}
/>;
```

`three` contains:

| Field              | Type                       | Notes                                         |
| ------------------ | -------------------------- | --------------------------------------------- |
| `scene`            | `THREE.Scene`              | Root scene                                    |
| `camera`           | `THREE.PerspectiveCamera`  | Globe camera                                  |
| `renderer`         | `THREE.WebGLRenderer`      | The WebGL renderer                            |
| `controls`         | `GlobeControls`            | Orbit/zoom controls (`radius`, `theta`, …)    |
| `planet`           | `THREE.Group`              | Surface + markers; child of `scene`           |
| `surfaceGroup`     | `THREE.Group`              | Textured surface + coastline lines            |
| `markerRoot`       | `THREE.Group`              | Marker meshes                                 |
| `getMarkerGroup()` | `THREE.Group \| null`      | Current marker group (rebuilds on clustering) |

The render loop is persistent — anything you add draws every frame. The globe lives on a unit sphere (surface ≈ radius `1.0`; one scene unit ≈ Earth's radius). **Always construct objects from the re-exported `THREE`**, not your own `import * as THREE from "three"`, so you share the globe's single instance.

## Props

| Prop                  | Type                          | Notes                          |
| --------------------- | ----------------------------- | ------------------------------ |
| `maps`                | `PlanetMapDefinition[]`       | Defaults to Earth + Moon       |
| `renderModes`         | `GlobeRenderModeDefinition[]` | Defaults to all four built-ins |
| `initialState`        | `CartoonPlanetInitialState`   | Map, mode, start view, markers |
| `onStateChange`       | `(state: GlobeState) => void` | HUD, fps, active map/mode      |
| `onReady`             | `(controller) => void`        | Fires when engine is ready     |
| `onSceneReady`        | `(three) => void`             | Live Three.js objects on mount |
| `className` / `style` | —                             | Root container                 |
| `children`            | React nodes                   | Composable UI (see above)      |

## Demo app included

The [`demo-app`](./demo-app) folder is a Vite + React playground that mirrors the quick start above — toolbar buttons call `flyTo`, `rotateBy`, and a scripted intro across all render modes, the "Warsaw bugs" button drills into the ground-level marker cluster, and `onSceneReady` adds a custom Three.js ring to show direct scene access.

```bash
cd demo-app && pnpm install && pnpm dev
```

## Links

- [Live demo online](https://react-cartoon-planet.paperplane.builders)
- [Repository](https://github.com/krzysztofradomski/react-cartoon-planet)
- [Issues](https://github.com/krzysztofradomski/react-cartoon-planet/issues)

## License

MIT © [radomski.dev](https://radomski.dev)
