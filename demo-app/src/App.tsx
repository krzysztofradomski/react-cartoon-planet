import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "react-cartoon-planet/style.css";
import "./App.css";
import {
  AltitudeDisplay,
  BUILTIN_RENDER_MODES,
  CartoonPlanet,
  EARTH_MAP,
  HintDisplay,
  LinksDisplay,
  MarkerLabelsDisplay,
  MarkerManagerControl,
  OutlineStyleControl,
  MOON_MAP,
  PlanetMapControl,
  PlacingToastDisplay,
  QuickJumpControl,
  RenderModeControl,
  ScaleBarDisplay,
  StartLevelControl,
  START_VIEWS,
  SURFACE_RENDER_MODE,
} from "react-cartoon-planet";
import type {
  CartoonPlanetController,
  CartoonPlanetInitialState,
  GlobeRenderModeDefinition,
  GlobeState,
  Marker,
  PlanetMapDefinition,
} from "react-cartoon-planet";
import { DEFAULT_MARKERS, WARSAW_LANDMARK_MARKERS } from "react-cartoon-planet";
import { playIntro } from "./playIntro";

const DEMO_MAPS: PlanetMapDefinition[] = [EARTH_MAP, MOON_MAP];
const DEMO_RENDER_MODES: GlobeRenderModeDefinition[] = BUILTIN_RENDER_MODES;

const DEMO_MARKERS: Marker[] = [...DEFAULT_MARKERS, ...WARSAW_LANDMARK_MARKERS];

const DEMO_INITIAL_STATE: CartoonPlanetInitialState = {
  map: EARTH_MAP,
  renderMode: SURFACE_RENDER_MODE,
  startView: "globe",
  markers: DEMO_MARKERS,
  linksEnabled: false,
};

function formatCoord(value: number | undefined, suffix: string) {
  if (value == null) return "…";
  return `${value.toFixed(2)}${suffix}`;
}

function prefersCompactDemoChrome() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 720px)").matches;
}

function App() {
  const controllerRef = useRef<CartoonPlanetController | null>(null);
  const cancelIntroRef = useRef<(() => void) | null>(null);
  const [planetState, setPlanetState] = useState<GlobeState | null>(null);
  const [introPlaying, setIntroPlaying] = useState(false);
  const [showAppControls, setShowAppControls] = useState(
    () => !prefersCompactDemoChrome(),
  );
  const [showGlobeControls, setShowGlobeControls] = useState(true);
  const [bloomOn, setBloomOn] = useState(true);
  const [dayNightOn, setDayNightOn] = useState(true);
  const [cloudsOn, setCloudsOn] = useState(true);
  const [clickedMarker, setClickedMarker] = useState<Marker | null>(null);

  const maps = useMemo(() => DEMO_MAPS, []);
  const renderModes = useMemo(() => DEMO_RENDER_MODES, []);
  const initialState = useMemo(() => DEMO_INITIAL_STATE, []);

  const hud = planetState?.hud;

  const handlePlayIntro = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller || introPlaying) return;

    cancelIntroRef.current?.();
    setIntroPlaying(true);
    cancelIntroRef.current = playIntro(controller, () => {
      cancelIntroRef.current = null;
      setIntroPlaying(false);
    });
  }, [introPlaying]);

  useEffect(() => {
    return () => {
      cancelIntroRef.current?.();
    };
  }, []);

  const rootClassName = [
    "demo-root",
    !showAppControls && "demo-root--hide-app",
    !showGlobeControls && "demo-root--hide-globe",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className={rootClassName}>
      <div className="demo-view-controls">
        <span className="demo-view-fps" aria-label="Frame rate">
          <span className="demo-view-fps-label">FPS</span>
          <span className="demo-view-fps-value">{planetState?.fps ?? 0}</span>
        </span>
        <div
          className="demo-view-toggles"
          role="group"
          aria-label="Display options"
        >
          <button
            type="button"
            className="demo-view-toggle"
            aria-pressed={showAppControls}
            onClick={() => setShowAppControls((visible) => !visible)}
          >
            App UI
          </button>
          <button
            type="button"
            className="demo-view-toggle"
            aria-pressed={showGlobeControls}
            onClick={() => setShowGlobeControls((visible) => !visible)}
          >
            Globe UI
          </button>
        </div>
      </div>

      {showAppControls && (
        <header className="demo-toolbar">
          <div className="demo-toolbar-copy">
            <h1>react-cartoon-planet</h1>
            <p>
              Fly from orbit to ground level, restyle the planet, and drop
              markers. Sidebar widgets are composable children — this toolbar
              drives the controller API.
            </p>
          </div>

          <div className="demo-toolbar-groups">
            <div className="demo-group">
              <span className="demo-group-label">Intro</span>
              <button
                type="button"
                className="demo-play-btn"
                disabled={introPlaying}
                aria-busy={introPlaying}
                onClick={handlePlayIntro}
              >
                {introPlaying ? "Playing…" : "Play"}
              </button>
            </div>

            <div className="demo-group">
              <span className="demo-group-label">Fly</span>
              <button
                type="button"
                onClick={() =>
                  controllerRef.current?.flyTo(-74.006, 40.7128, 1_500)
                }
              >
                NYC
              </button>
              <button
                type="button"
                onClick={() =>
                  controllerRef.current?.flyTo(139.6917, 35.6895, 1_500)
                }
              >
                Tokyo
              </button>
              <button
                type="button"
                onClick={() =>
                  controllerRef.current?.flyTo(21.0122, 52.2297, 6)
                }
              >
                Warsaw landmarks
              </button>
              <button
                type="button"
                onClick={() =>
                  controllerRef.current?.flyTo(
                    START_VIEWS.globe.lng,
                    START_VIEWS.globe.lat,
                    START_VIEWS.globe.alt_m,
                    { duration: 900 },
                  )
                }
              >
                Reset view
              </button>
            </div>

            <div className="demo-group">
              <span className="demo-group-label">Layers</span>
              <button
                type="button"
                aria-pressed={dayNightOn}
                onClick={() => setDayNightOn((enabled) => !enabled)}
              >
                Day/Night
              </button>
              <button
                type="button"
                aria-pressed={cloudsOn}
                onClick={() => setCloudsOn((enabled) => !enabled)}
              >
                Clouds
              </button>
              <button
                type="button"
                aria-pressed={bloomOn}
                onClick={() => setBloomOn((enabled) => !enabled)}
              >
                Bloom
              </button>
            </div>

            <div className="demo-group">
              <span className="demo-group-label">Rotate</span>
              <div className="demo-pad" role="group" aria-label="Rotate globe">
                <button
                  type="button"
                  className="demo-pad-btn demo-pad-up"
                  aria-label="Rotate north"
                  onClick={() => controllerRef.current?.rotateBy(0, 10)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="demo-pad-btn demo-pad-left"
                  aria-label="Rotate west"
                  onClick={() => controllerRef.current?.rotateBy(-15, 0)}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="demo-pad-btn demo-pad-right"
                  aria-label="Rotate east"
                  onClick={() => controllerRef.current?.rotateBy(15, 0)}
                >
                  →
                </button>
                <button
                  type="button"
                  className="demo-pad-btn demo-pad-down"
                  aria-label="Rotate south"
                  onClick={() => controllerRef.current?.rotateBy(0, -10)}
                >
                  ↓
                </button>
              </div>
            </div>
          </div>
        </header>
      )}

      <section className="demo-canvas">
        <CartoonPlanet
          ref={controllerRef}
          maps={maps}
          renderModes={renderModes}
          initialState={initialState}
          onStateChange={setPlanetState}
          bloom={bloomOn}
          dayNight={dayNightOn}
          clouds={cloudsOn}
          onSceneReady={(three) => {
            // Live Three.js objects — exposed for devtools tinkering
            // (e.g. `__three.scene.add(...)` from the console).
            (window as unknown as Record<string, unknown>).__three = three;
          }}
          onMarkerClick={(marker) => {
            // Show the info card; returning nothing keeps the default fly-to.
            setClickedMarker(marker);
          }}
          // onSceneReady={(three) => {
          //   // Example: drop a custom object into the globe scene (import THREE from react-cartoon-planet).
          //   // const ring = new THREE.Mesh(
          //   //   new THREE.TorusGeometry(1.25, 0.012, 12, 96),
          //   //   new THREE.MeshBasicMaterial({ color: "#ff2eea" }),
          //   // );
          //   // ring.rotation.x = Math.PI / 2;
          //   // three.scene.add(ring);
          // }}
        >
          {showGlobeControls && (
            <>
              <AltitudeDisplay />
              <ScaleBarDisplay />
              <MarkerLabelsDisplay />
              <PlacingToastDisplay />
              <HintDisplay />
              <StartLevelControl />
              <PlanetMapControl />
              <RenderModeControl />
              <OutlineStyleControl />
              <LinksDisplay />
              <QuickJumpControl />
              <MarkerManagerControl />
            </>
          )}
        </CartoonPlanet>

        {clickedMarker && (
          <aside className="demo-marker-card" aria-live="polite">
            <span
              className="demo-marker-card-dot"
              style={{ background: clickedMarker.color ?? "#ff5e3a" }}
            />
            <div className="demo-marker-card-body">
              <strong>
                {clickedMarker.isCluster
                  ? `${clickedMarker.clusterCount} clustered landmarks`
                  : clickedMarker.label}
              </strong>
              <span>
                {clickedMarker.lat.toFixed(4)}°, {clickedMarker.lng.toFixed(4)}
                ° · via onMarkerClick
              </span>
            </div>
            <button
              type="button"
              className="demo-marker-card-close"
              aria-label="Dismiss marker details"
              onClick={() => setClickedMarker(null)}
            >
              ×
            </button>
          </aside>
        )}
      </section>

      {showAppControls && (
        <footer className="demo-status">
          <span className="demo-stat">
            <span className="demo-stat-label">lng</span>
            <span className="demo-stat-value">
              {formatCoord(hud?.focusLng, "°")}
            </span>
          </span>
          <span className="demo-stat">
            <span className="demo-stat-label">lat</span>
            <span className="demo-stat-value">
              {formatCoord(hud?.focusLat, "°")}
            </span>
          </span>
          <span className="demo-stat">
            <span className="demo-stat-label">alt</span>
            <span className="demo-stat-value">{hud?.scaleLabel ?? "…"}</span>
          </span>
          <span className="demo-stat">
            <span className="demo-stat-label">mode</span>
            <span className="demo-stat-value">
              {planetState?.renderMode ?? "…"}
            </span>
          </span>
          <span className="demo-stat">
            <span className="demo-stat-label">map</span>
            <span className="demo-stat-value">
              {planetState?.planetMap ?? "…"}
            </span>
          </span>
        </footer>
      )}
    </main>
  );
}

export default App;
