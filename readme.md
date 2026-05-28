# react-cartoon-planet

Animated cartoon globe for React — zoom from orbit to ground level, switch visual styles, drop markers, and drive the camera from your own UI.

<video src="https://raw.githubusercontent.com/radomski/react-cartoon-planet/main/media/demo.mp4" width="100%" autoplay loop muted playsinline></video>

## Install

```bash
npm install react-cartoon-planet
# or
pnpm add react-cartoon-planet
```

**Peer dependencies** (you install these):

- `react` (18 or 19)
- `react-dom`

**Dependencies** (installed automatically with the package):

- [`three`](https://threejs.org/) — WebGL scene, globe mesh, markers, and custom render modes
- [`earcut`](https://github.com/mapbox/earcut) — polygon triangulation for continent geometry

You do not need to add `three` or `earcut` yourself unless you build custom render modes or import Three.js types directly — then align with the version the package ships (`three@^0.160`).

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
  PlanetMapControl,
  PlacingToastDisplay,
  QuickJumpControl,
  RenderModeControl,
  ScaleBarDisplay,
  StartLevelControl,
  SURFACE_RENDER_MODE,
} from "react-cartoon-planet";
import type { CartoonPlanetController, GlobeState } from "react-cartoon-planet";

export function GlobeDemo() {
  const controllerRef = useRef<CartoonPlanetController | null>(null);
  const [planetState, setPlanetState] = useState<GlobeState | null>(null);

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <header>
        <button onClick={() => controllerRef.current?.flyTo(-74.006, 40.7128, 1_500)}>
          Fly to NYC
        </button>
        <button onClick={() => controllerRef.current?.rotateTo(0, 20, { duration: 900 })}>
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
        <QuickJumpControl />
        <MarkerManagerControl />
      </CartoonPlanet>

      <footer>
        lng {planetState?.hud.focusLng?.toFixed(2)}° · alt {planetState?.hud.scaleLabel}
      </footer>
    </div>
  );
}
```

Give the canvas room to breathe — the globe fills its container (`width` / `height: 100%` on a sized parent works well).

## Render modes

Four built-in styles ship out of the box. Switch them in the sidebar (`RenderModeControl`) or via `controller.setRenderMode("Cyber")`.

| Solid | Dots |
| --- | --- |
| ![Solid render mode](https://raw.githubusercontent.com/radomski/react-cartoon-planet/main/media/solid-big.png) | ![Dots render mode](https://raw.githubusercontent.com/radomski/react-cartoon-planet/main/media/dots-big.png) |

| Hybrid | Cyber |
| --- | --- |
| ![Hybrid render mode](https://raw.githubusercontent.com/radomski/react-cartoon-planet/main/media/hybrid-big.png) | ![Cyber render mode](https://raw.githubusercontent.com/radomski/react-cartoon-planet/main/media/cyber-big.png) |

Cyber mode in motion:

<video src="https://raw.githubusercontent.com/radomski/react-cartoon-planet/main/media/cyber-short.mp4" width="100%" autoplay loop muted playsinline></video>

Presets: `SURFACE_RENDER_MODE` (Solid), `DOTS_RENDER_MODE`, `HYBRID_RENDER_MODE`, `CYBERPUNK_RENDER_MODE`, or the full `BUILTIN_RENDER_MODES` array.

## Planet maps

- **Earth** — `EARTH_MAP` (bundled GeoJSON, blue ocean / green land)
- **Moon** — `MOON_MAP` (bundled maria data)

Pass your own `PlanetMapDefinition` with a GeoJSON URL, or pre-parsed `continents` to skip the fetch. Use `flattenGeoJsonToContinents` if you already have GeoJSON in memory.

## Controller API

Attach a ref (`useRef<CartoonPlanetController>()`) or use `onReady` to get the controller.

| Method | Description |
| --- | --- |
| `flyTo(lng, lat, altitudeMeters, options?)` | Animated camera move (default 1800 ms) |
| `flyToAltitude(altitudeMeters, options?)` | Zoom in/out at current heading |
| `flyToMarker(id)` | Fly to a marker by id |
| `rotateBy(lngDelta, latDelta, options?)` | Nudge heading (default 600 ms) |
| `rotateTo(lng, lat, options?)` | Absolute heading at current altitude |
| `startAutoRotate` / `stopAutoRotate` | Continuous spin |
| `getView()` | Current `{ lng, lat, altitudeMeters }` |
| `setRenderMode(mode)` | Switch visual style (name or definition) |
| `setPlanetMap(map)` | Switch planet map |
| `setStartView("globe" \| "ground")` | Orbit vs near-ground preset |
| `setMarkers` / `addMarker` / `removeMarker` | Marker CRUD |
| `startPlacing` / `cancelPlacing` | Click-to-place marker mode |
| `setLinksEnabled(boolean)` | Toggle marker link lines |
| `getState()` / `subscribe(listener)` | Reactive globe state |

`onStateChange` on `<CartoonPlanet>` is the React-friendly alternative to `subscribe`.

## Composable UI

Sidebar panels and HUD widgets are optional React children — include only what you need:

| Component | Role |
| --- | --- |
| `FpsDisplay` | Frame rate |
| `AltitudeDisplay` | Current altitude |
| `ScaleBarDisplay` | Map scale bar |
| `MarkerLabelsDisplay` | Screen-space marker labels |
| `PlacingToastDisplay` | “Click globe to place” hint |
| `HintDisplay` | Interaction hints |
| `StartLevelControl` | Globe / ground start level |
| `PlanetMapControl` | Earth / Moon (or custom maps) |
| `RenderModeControl` | Style picker |
| `QuickJumpControl` | Preset locations |
| `MarkerManagerControl` | Add / remove markers |
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

## Props

| Prop | Type | Notes |
| --- | --- | --- |
| `maps` | `PlanetMapDefinition[]` | Defaults to Earth + Moon |
| `renderModes` | `GlobeRenderModeDefinition[]` | Defaults to all four built-ins |
| `initialState` | `CartoonPlanetInitialState` | Map, mode, start view, markers |
| `onStateChange` | `(state: GlobeState) => void` | HUD, fps, active map/mode |
| `onReady` | `(controller) => void` | Fires when engine is ready |
| `className` / `style` | — | Root container |
| `children` | React nodes | Composable UI (see above) |

## Live demo

The [`demo-app`](./demo-app) folder is a Vite + React playground that mirrors the quick start above — toolbar buttons call `flyTo`, `rotateBy`, and a scripted intro across all render modes.

```bash
cd demo-app && pnpm install && pnpm dev
```

## Links

- [Homepage](https://radomski.dev/react-cartoon-planet)
- [Repository](https://github.com/radomski/react-cartoon-planet)
- [Issues](https://github.com/radomski/react-cartoon-planet/issues)

## License

MIT © [radomski.dev](https://radomski.dev)
