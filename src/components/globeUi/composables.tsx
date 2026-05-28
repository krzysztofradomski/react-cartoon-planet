import { useEffect, useRef, useState, type RefObject } from 'react';
import type { GlobeController } from '../../globeController';
import type { GlobeEnginePort, GlobeState, Marker, MarkerShape } from '../../types';
import { assignCartoonPlanetSlot, useCartoonPlanet } from '../../context/cartoonPlanetContext';

function AltitudeCoordinatesHUD({ hud }: { hud: GlobeState['hud'] }) {
  return (
    <div className="hud hud-tl">
      <div className="hud-row">
        <span className="hud-label">ALT</span>
        <span className="hud-value">{hud.scaleLabel}</span>
      </div>
      <div className="hud-row">
        <span className="hud-label">LAT</span>
        <span className="hud-value">{hud.focusLat.toFixed(3)}°</span>
      </div>
      <div className="hud-row">
        <span className="hud-label">LNG</span>
        <span className="hud-value">{hud.focusLng.toFixed(3)}°</span>
      </div>
    </div>
  );
}

function FpsDebugHUD({ fps }: { fps: number }) {
  return (
    <div className="hud hud-debug" aria-label="Frame rate">
      <div className="hud-row">
        <span className="hud-label">FPS</span>
        <span className="hud-value">{fps}</span>
      </div>
    </div>
  );
}

function ScaleBarHUD({ hud }: { hud: GlobeState['hud'] }) {
  return (
    <div className="scalebar">
      <div className="scalebar-track" style={{ width: hud.scaleBarPx }}>
        <div className="scalebar-tick" />
        <div className="scalebar-tick scalebar-tick-r" />
      </div>
      <div className="scalebar-label">{hud.scaleBarLabel}</div>
    </div>
  );
}

function StartLevelControlPanel({
  startView,
  setInitialView,
}: {
  startView: GlobeState['startView'];
  setInitialView: (view: GlobeState['startView']) => void;
}) {
  return (
    <div className="panel">
      <div className="panel-title">Start level</div>
      <div className="segmented" role="group" aria-label="Initial start level">
        <button
          type="button"
          className={startView === 'globe' ? 'is-active' : ''}
          aria-pressed={startView === 'globe'}
          onClick={() => setInitialView('globe')}
        >
          Globe
        </button>
        <button
          type="button"
          className={startView === 'ground' ? 'is-active' : ''}
          aria-pressed={startView === 'ground'}
          onClick={() => setInitialView('ground')}
        >
          Ground
        </button>
      </div>
    </div>
  );
}

function PlanetMapControlPanel({
  planetMap,
  selectPlanetMap,
  controller,
}: {
  planetMap: string;
  selectPlanetMap: (name: string) => void;
  controller: GlobeController;
}) {
  const maps = controller.getMaps();
  if (maps.length <= 1) return null;
  return (
    <div className="panel">
      <div className="panel-title">Planet map</div>
      <div className="segmented" role="group" aria-label="Planet map">
        {maps.map((map) => (
          <button
            key={map.name}
            type="button"
            className={planetMap === map.name ? 'is-active' : ''}
            aria-pressed={planetMap === map.name}
            onClick={() => selectPlanetMap(map.name)}
          >
            {map.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function RenderModeControlPanel({
  renderMode,
  selectRenderMode,
  controller,
}: {
  renderMode: string;
  selectRenderMode: (name: string) => void;
  controller: GlobeController;
}) {
  const modes = controller.getRenderModes();
  return (
    <div className="panel">
      <div className="panel-title">Render mode</div>
      <div className="segmented" role="group" aria-label="Render mode">
        {modes.map((mode) => (
          <button
            key={mode.name}
            type="button"
            className={renderMode === mode.name ? 'is-active' : ''}
            aria-pressed={renderMode === mode.name}
            onClick={() => selectRenderMode(mode.name)}
          >
            {mode.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuickJumpControlPanel({ flyTo }: { flyTo: (lng: number, lat: number, alt_m: number) => void }) {
  return (
    <div className="panel">
      <div className="panel-title">Quick jump</div>
      <button type="button" onClick={() => flyTo(0, 20, 6_000_000)}>
        🌍 Whole planet
      </button>
      <button type="button" onClick={() => flyTo(-100, 40, 3_500_000)}>
        North America
      </button>
      <button type="button" onClick={() => flyTo(-60, -15, 3_500_000)}>
        South America
      </button>
      <button type="button" onClick={() => flyTo(20, 5, 3_500_000)}>
        Africa
      </button>
      <button type="button" onClick={() => flyTo(15, 50, 2_500_000)}>
        Europe
      </button>
      <button type="button" onClick={() => flyTo(100, 30, 4_500_000)}>
        Asia
      </button>
      <button type="button" onClick={() => flyTo(135, -25, 3_000_000)}>
        Oceania
      </button>
      <button type="button" onClick={() => flyTo(0, -89, 4_000_000)}>
        Antarctica
      </button>
    </div>
  );
}

function LinksControlPanel({
  linksEnabled,
  controller,
}: {
  linksEnabled: boolean;
  controller: GlobeController;
}) {
  return (
    <div className="panel">
      <div className="panel-title">Links</div>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          fontSize: 12,
          color: 'var(--hud-fg)',
        }}
      >
        <input
          type="checkbox"
          checked={!!linksEnabled}
          onChange={(e) => controller.setLinksEnabled(e.target.checked)}
          style={{ accentColor: 'var(--accent)', cursor: 'pointer', margin: 0 }}
        />
        Show marker links
      </label>
    </div>
  );
}

function MarkerManagerPanel({
  markers,
  setMarkers,
  flyTo,
  placingMode,
  setPlacingMode,
  enginePortRef,
  controller,
}: {
  markers: Marker[];
  setMarkers: (m: Marker[]) => void;
  flyTo: (lng: number, lat: number, alt: number) => void;
  placingMode: boolean;
  setPlacingMode: (v: boolean) => void;
  enginePortRef: RefObject<GlobeEnginePort>;
  controller: GlobeController;
}) {
  const [editorData, setEditorData] = useState<{ lat: number; lng: number } | null>(null);
  const [label, setLabel] = useState('');
  const [shape, setShape] = useState<MarkerShape>('orb');
  const [color, setColor] = useState('#ff5e3a');
  const [size, setSize] = useState(0.024);
  const [isOrbital, setIsOrbital] = useState(false);
  const [orbitAlt, setOrbitAlt] = useState(1.18);
  const [nodeA, setNodeA] = useState('');
  const [nodeB, setNodeB] = useState('');

  const colorPresets = [
    { value: '#ff2eea', label: 'Magenta' },
    { value: '#00f5ff', label: 'Cyan' },
    { value: '#39ffd7', label: 'Lime' },
    { value: '#ffe600', label: 'Yellow' },
    { value: '#7c5cff', label: 'Purple' },
    { value: '#ff5e3a', label: 'Coral' },
  ];

  useEffect(() => {
    const port = enginePortRef.current;
    if (!port) return;
    port.onGlobeClick = (lng, lat) => {
      setEditorData({ lat, lng });
      setLabel(`Marker at ${lat.toFixed(1)}°, ${lng.toFixed(1)}°`);
      setPlacingMode(false);
      setSize(0.024);
      setIsOrbital(false);
      setOrbitAlt(1.18);
      const availableNodes = markers.filter((m) => !m.isOrbital);
      if (availableNodes.length >= 2) {
        setNodeA(availableNodes[0].id);
        setNodeB(availableNodes[1].id);
      } else {
        setNodeA('');
        setNodeB('');
      }
    };
    return () => {
      if (port) {
        port.onGlobeClick = null;
      }
    };
  }, [enginePortRef, setPlacingMode, markers]);

  function handleAddClick() {
    setEditorData(null);
    setPlacingMode(true);
  }

  function handleCancelPlacing() {
    setPlacingMode(false);
  }

  function handleSave() {
    if (!editorData) return;
    const newMarker: Marker = {
      id: 'custom_' + Date.now(),
      label: label.trim() || `Marker at ${editorData.lat.toFixed(1)}°, ${editorData.lng.toFixed(1)}°`,
      lng: editorData.lng,
      lat: editorData.lat,
      shape,
      color,
      size: Number(size),
      isOrbital,
      altitude: isOrbital ? Number(orbitAlt) : 1.0,
      orbitNodeA: isOrbital ? nodeA : '',
      orbitNodeB: isOrbital ? nodeB : '',
    };
    setMarkers([...markers, newMarker]);
    setEditorData(null);
  }

  function handleDelete(id: string) {
    setMarkers(markers.filter((m) => m.id !== id));
  }

  return (
    <div className="panel">
      <div className="panel-title">Markers</div>

      {!placingMode && !editorData && (
        <button
          type="button"
          onClick={handleAddClick}
          style={{
            width: '100%',
            textAlign: 'center',
            marginBottom: 8,
            background: 'rgba(255, 94, 58, 0.12)',
            borderColor: 'var(--accent)',
          }}
        >
          ➕ Add Custom Marker
        </button>
      )}

      {placingMode && (
        <button
          type="button"
          onClick={handleCancelPlacing}
          style={{
            width: '100%',
            textAlign: 'center',
            marginBottom: 8,
            background: 'rgba(255, 94, 58, 0.06)',
            borderColor: 'var(--hud-dim)',
          }}
        >
          🚫 Cancel Placement
        </button>
      )}

      {editorData && (
        <div className="marker-editor-card">
          <div className="marker-editor-title">Configure Marker</div>
          <div className="marker-editor-row">
            <input
              type="text"
              className="marker-editor-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Marker Label"
            />
          </div>

          <div className="marker-editor-row">
            <div className="marker-editor-title" style={{ fontSize: 9 }}>
              Shape
            </div>
            <div className="segmented" style={{ padding: 2, marginBottom: 0 }}>
              {(['orb', 'cube', 'bar'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={shape === value ? 'is-active' : ''}
                  onClick={() => setShape(value)}
                  style={{ padding: '3px 4px', fontSize: 10, textAlign: 'center' }}
                >
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="marker-editor-row">
            <div className="marker-editor-title" style={{ fontSize: 9 }}>
              Color
            </div>
            <div className="marker-editor-colors">
              {colorPresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`color-swatch-btn ${color === preset.value ? 'is-active' : ''}`}
                  style={{ background: preset.value }}
                  onClick={() => setColor(preset.value)}
                  title={preset.label}
                />
              ))}
            </div>
          </div>

          <div className="marker-editor-row">
            <div
              className="marker-editor-title"
              style={{ fontSize: 9, display: 'flex', justifyContent: 'space-between' }}
            >
              <span>Size</span>
              <span>{(size * 1000).toFixed(0)} units</span>
            </div>
            <input
              type="range"
              min="0.01"
              max="0.05"
              step="0.002"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', margin: '4px 0' }}
            />
          </div>

          <div className="marker-editor-row">
            <div className="marker-editor-title" style={{ fontSize: 9 }}>
              Placement
            </div>
            {markers.filter((m) => !m.isOrbital).length >= 2 ? (
              <div className="segmented" style={{ padding: 2, marginBottom: 0 }}>
                <button
                  type="button"
                  className={!isOrbital ? 'is-active' : ''}
                  onClick={() => setIsOrbital(false)}
                  style={{ padding: '3px 4px', fontSize: 10, textAlign: 'center' }}
                >
                  Surface
                </button>
                <button
                  type="button"
                  className={isOrbital ? 'is-active' : ''}
                  onClick={() => {
                    setIsOrbital(true);
                    const av = markers.filter((m) => !m.isOrbital);
                    if (av.length >= 2 && (!nodeA || !nodeB)) {
                      setNodeA(av[0].id);
                      setNodeB(av[1].id);
                    }
                  }}
                  style={{ padding: '3px 4px', fontSize: 10, textAlign: 'center' }}
                >
                  Orbit
                </button>
              </div>
            ) : (
              <div
                style={{
                  color: 'var(--hud-dim)',
                  fontSize: 9,
                  fontStyle: 'italic',
                  lineHeight: '1.2',
                  marginTop: 2,
                }}
              >
                ⚠️ Orbit placement requires at least 2 existing surface markers to define the orbital plane.
              </div>
            )}
          </div>

          {isOrbital && markers.filter((m) => !m.isOrbital).length >= 2 && (
            <>
              <div className="marker-editor-row" style={{ display: 'flex', flexDirection: 'row', gap: 6 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="marker-editor-title" style={{ fontSize: 8 }}>
                    Orbit Node A
                  </span>
                  <select
                    value={nodeA}
                    onChange={(e) => setNodeA(e.target.value)}
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 4,
                      color: 'var(--hud-fg)',
                      fontSize: 10,
                      padding: '3px 4px',
                      outline: 'none',
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    {markers
                      .filter((m) => !m.isOrbital)
                      .map((m) => (
                        <option key={m.id} value={m.id} style={{ background: '#0a0e1a', color: '#fff' }}>
                          {m.label}
                        </option>
                      ))}
                  </select>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="marker-editor-title" style={{ fontSize: 8 }}>
                    Orbit Node B
                  </span>
                  <select
                    value={nodeB}
                    onChange={(e) => setNodeB(e.target.value)}
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 4,
                      color: 'var(--hud-fg)',
                      fontSize: 10,
                      padding: '3px 4px',
                      outline: 'none',
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    {markers
                      .filter((m) => !m.isOrbital)
                      .map((m) => (
                        <option key={m.id} value={m.id} style={{ background: '#0a0e1a', color: '#fff' }}>
                          {m.label}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {nodeA === nodeB && (
                <div style={{ color: 'var(--accent)', fontSize: 9, fontStyle: 'italic', marginTop: -2 }}>
                  💡 Select 2 different nodes for a tilted orbit; same nodes use a flat equator orbit.
                </div>
              )}

              <div className="marker-editor-row">
                <div
                  className="marker-editor-title"
                  style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}
                >
                  <span>Orbit Altitude</span>
                  <span>{((orbitAlt - 1.0) * 6371).toFixed(0)} km</span>
                </div>
                <input
                  type="range"
                  min="1.08"
                  max="1.35"
                  step="0.01"
                  value={orbitAlt}
                  onChange={(e) => setOrbitAlt(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', margin: '4px 0' }}
                />
              </div>
            </>
          )}

          <div className="marker-editor-actions">
            <button type="button" className="marker-item-btn marker-editor-btn" onClick={() => setEditorData(null)}>
              Cancel
            </button>
            <button type="button" className="marker-item-btn marker-editor-btn marker-editor-btn-save" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      )}

      {markers.length > 0 && (
        <div className="marker-list">
          {markers.map((m) => (
            <div key={m.id} className="marker-item">
              <div className="marker-item-info">
                <span
                  className="marker-swatch"
                  style={{ background: m.color, color: m.color, width: 6, height: 6 }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span className="marker-item-text" title={m.label}>
                    {m.label}
                  </span>
                  <span className="marker-item-coords">
                    {m.lat.toFixed(1)}°, {m.lng.toFixed(1)}°
                  </span>
                </div>
              </div>
              <div className="marker-item-actions">
                <button type="button" className="marker-item-btn" onClick={() => flyTo(m.lng, m.lat, 1500)}>
                  Fly
                </button>
                <button type="button" className="marker-item-btn marker-item-btn-delete" onClick={() => handleDelete(m.id)}>
                  Del
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const AltitudeDisplay = assignCartoonPlanetSlot('root', function AltitudeDisplay() {
  const { globeState } = useCartoonPlanet();
  return <AltitudeCoordinatesHUD hud={globeState.hud} />;
});

export const FpsDisplay = assignCartoonPlanetSlot('overlay', function FpsDisplay() {
  const { globeState } = useCartoonPlanet();
  return <FpsDebugHUD fps={globeState.fps} />;
});

export const ScaleBarDisplay = assignCartoonPlanetSlot('root', function ScaleBarDisplay() {
  const { globeState } = useCartoonPlanet();
  return <ScaleBarHUD hud={globeState.hud} />;
});

export const MarkerLabelsDisplay = assignCartoonPlanetSlot('root', function MarkerLabelsDisplay() {
  const { globeState } = useCartoonPlanet();
  return (
    <div className="marker-layer" aria-hidden="true">
      {globeState.markerLabels.map(
        (marker) =>
          marker.visible && (
            <div key={marker.id} className="marker-label" style={{ left: marker.x, top: marker.y }}>
              <span className="marker-swatch" style={{ color: marker.color, background: marker.color }} />
              <span className="marker-text">{marker.label}</span>
            </div>
          )
      )}
    </div>
  );
});

export const LinksDisplay = assignCartoonPlanetSlot('overlay', function LinksDisplay() {
  const { globeState, controller } = useCartoonPlanet();
  return <LinksControlPanel linksEnabled={globeState.linksEnabled} controller={controller} />;
});

export const PlacingToastDisplay = assignCartoonPlanetSlot('root', function PlacingToastDisplay() {
  const { globeState } = useCartoonPlanet();
  if (!globeState.placingMode) return null;
  return <div className="placing-toast">Click on the globe to place your custom marker</div>;
});

export const HintDisplay = assignCartoonPlanetSlot('root', function HintDisplay() {
  return <div className="hint">drag to pan · scroll to zoom</div>;
});

export const StartLevelControl = assignCartoonPlanetSlot('overlay', function StartLevelControl() {
  const { globeState, setInitialView } = useCartoonPlanet();
  return <StartLevelControlPanel startView={globeState.startView} setInitialView={setInitialView} />;
});

export const PlanetMapControl = assignCartoonPlanetSlot('overlay', function PlanetMapControl() {
  const { globeState, controller, selectPlanetMap } = useCartoonPlanet();
  return (
    <PlanetMapControlPanel
      planetMap={globeState.planetMap}
      selectPlanetMap={selectPlanetMap}
      controller={controller}
    />
  );
});

export const RenderModeControl = assignCartoonPlanetSlot('overlay', function RenderModeControl() {
  const { globeState, controller, selectRenderMode } = useCartoonPlanet();
  return (
    <RenderModeControlPanel
      renderMode={globeState.renderMode}
      selectRenderMode={selectRenderMode}
      controller={controller}
    />
  );
});

export const QuickJumpControl = assignCartoonPlanetSlot('overlay', function QuickJumpControl() {
  const { flyTo } = useCartoonPlanet();
  return <QuickJumpControlPanel flyTo={flyTo} />;
});

export const MarkerManagerControl = assignCartoonPlanetSlot('overlay', function MarkerManagerControl() {
  const { globeState, controller, enginePortRef, flyTo, setPlacingMode } = useCartoonPlanet();
  return (
    <MarkerManagerPanel
      markers={globeState.markers}
      setMarkers={(list) => controller.setMarkers(list)}
      flyTo={flyTo}
      placingMode={globeState.placingMode}
      setPlacingMode={setPlacingMode}
      enginePortRef={enginePortRef}
      controller={controller}
    />
  );
});

export const CartoonPlanetDefaultUi = assignCartoonPlanetSlot('root', function CartoonPlanetDefaultUi() {
  return (
    <>
      <AltitudeDisplay />
      <ScaleBarDisplay />
      <MarkerLabelsDisplay />
      <PlacingToastDisplay />
      <HintDisplay />
      <FpsDisplay />
      <StartLevelControl />
      <PlanetMapControl />
      <RenderModeControl />
      <QuickJumpControl />
      <MarkerManagerControl />
    </>
  );
});
