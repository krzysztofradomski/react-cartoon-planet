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
  GlobeLayerBuilder,
  GlobeRenderModeDefinition,
  GlobeState,
  Marker,
  PlanetMapDefinition,
} from "react-cartoon-planet";
import {
  DEFAULT_MARKERS,
  THREE,
  WARSAW_LANDMARK_MARKERS,
} from "react-cartoon-planet";
import { playIntro } from "./playIntro";

// Custom cloud generator (GlobeLayerBuilder) for the Vapor map: neon streak
// bands instead of the library's built-in puffy clouds. Build from the
// package's re-exported THREE; `userData.update` runs every frame.
const buildVaporClouds: GlobeLayerBuilder = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  for (let i = 0; i < 110; i++) {
    const x = Math.random() * 1024;
    const y = 80 + Math.random() * 352;
    const w = 60 + Math.random() * 220;
    const h = 3 + Math.random() * 9;
    const tint = `255, ${170 + Math.floor(Math.random() * 70)}, 252`;
    const grad = ctx.createLinearGradient(x - w, y, x + w, y);
    grad.addColorStop(0, `rgba(${tint}, 0)`);
    grad.addColorStop(0.5, `rgba(${tint}, ${0.12 + Math.random() * 0.14})`);
    grad.addColorStop(1, `rgba(${tint}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.02, 64, 48), material);
  mesh.renderOrder = 3;
  mesh.userData.update = ({ alt }: { alt: number }) => {
    mesh.rotation.y -= 0.0004; // drift against the planet's spin
    material.opacity = THREE.MathUtils.clamp((alt - 60_000) / 700_000, 0, 0.9);
  };
  return mesh;
};

const VAPOR_MAP: PlanetMapDefinition = {
  name: "Vapor",
  url: EARTH_MAP.url,
  oceanColor: "#7c4fd4",
  landColor: "#2ee6a8",
  atmosphereColor: "#ff7ad9",
  atmosphereStrength: 1.1,
  clouds: buildVaporClouds,
  nightLights: true,
};

const DEMO_MAPS: PlanetMapDefinition[] = [EARTH_MAP, MOON_MAP, VAPOR_MAP];
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
          <h1 className="demo-toolbar-title">react-cartoon-planet</h1>

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
              <div
                className="demo-pad demo-pad--inline"
                role="group"
                aria-label="Rotate globe"
              >
                <button
                  type="button"
                  className="demo-pad-btn"
                  aria-label="Rotate north"
                  onClick={() => controllerRef.current?.rotateBy(0, 10)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="demo-pad-btn"
                  aria-label="Rotate west"
                  onClick={() => controllerRef.current?.rotateBy(-15, 0)}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="demo-pad-btn"
                  aria-label="Rotate east"
                  onClick={() => controllerRef.current?.rotateBy(15, 0)}
                >
                  →
                </button>
                <button
                  type="button"
                  className="demo-pad-btn"
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
