import { useMemo, useRef, useState } from "react";
import "react-cartoon-planet/style.css";
import "./App.css";
import {
  BUILTIN_RENDER_MODES,
  CartoonPlanet,
  EARTH_MAP,
  MOON_MAP,
  SURFACE_RENDER_MODE,
  type CartoonPlanetController,
  type CartoonPlanetInitialState,
  type GlobeRenderModeDefinition,
  type GlobeState,
  type PlanetMapDefinition,
} from "react-cartoon-planet";

/** Maps are `{ name, url }` records — url can be bundled or remote GeoJSON. */
const DEMO_MAPS: PlanetMapDefinition[] = [EARTH_MAP, MOON_MAP];

/** Render modes are `{ name, renderFunction }` — swap in your own THREE.js builder. */
const DEMO_RENDER_MODES: GlobeRenderModeDefinition[] = BUILTIN_RENDER_MODES;

const DEMO_INITIAL_STATE: CartoonPlanetInitialState = {
  map: EARTH_MAP,
  renderMode: SURFACE_RENDER_MODE,
  startView: "globe",
};

function App() {
  const controllerRef = useRef<CartoonPlanetController | null>(null);
  const [planetState, setPlanetState] = useState<GlobeState | null>(null);

  const maps = useMemo(() => DEMO_MAPS, []);
  const renderModes = useMemo(() => DEMO_RENDER_MODES, []);
  const initialState = useMemo(() => DEMO_INITIAL_STATE, []);

  const activeMap = maps.find((m) => m.name === planetState?.planetMap);
  const activeMode = renderModes.find(
    (m) => m.name === planetState?.renderMode,
  );

  return (
    <main className="demo-root">
      <header className="demo-toolbar">
        <h1>react-cartoon-planet demo</h1>

        <div className="demo-actions">
          <span className="demo-actions-label">Render</span>
          {renderModes.map((mode) => (
            <button
              key={mode.name}
              type="button"
              className={
                planetState?.renderMode === mode.name ? "is-active" : ""
              }
              onClick={() => controllerRef.current?.setRenderMode(mode)}
            >
              {mode.name}
            </button>
          ))}

          <span className="demo-actions-label">Map</span>
          {maps.map((map) => (
            <button
              key={map.name}
              type="button"
              className={planetState?.planetMap === map.name ? "is-active" : ""}
              onClick={() => controllerRef.current?.setPlanetMap(map)}
            >
              {map.name}
            </button>
          ))}

          <span className="demo-actions-label">View</span>
          <button
            type="button"
            className={planetState?.startView === "globe" ? "is-active" : ""}
            onClick={() => controllerRef.current?.setStartView("globe")}
          >
            Globe
          </button>
          <button
            type="button"
            className={planetState?.startView === "ground" ? "is-active" : ""}
            onClick={() => controllerRef.current?.setStartView("ground")}
          >
            Ground
          </button>
          <button
            type="button"
            onClick={() =>
              controllerRef.current?.flyTo(-74.006, 40.7128, 1_500)
            }
          >
            Fly NYC
          </button>
        </div>
      </header>

      <section className="demo-canvas">
        <CartoonPlanet
          ref={controllerRef}
          maps={maps}
          renderModes={renderModes}
          initialState={initialState}
          onStateChange={setPlanetState}
        />
      </section>

      <section className="demo-status">
        <span>mode: {activeMode?.name ?? planetState?.renderMode ?? "…"}</span>
        <span>map: {activeMap?.name ?? planetState?.planetMap ?? "…"}</span>
        <span>map url: {activeMap?.url ?? "…"}</span>
        <span>fps: {planetState?.fps ?? 0}</span>
      </section>
    </main>
  );
}

export default App;
