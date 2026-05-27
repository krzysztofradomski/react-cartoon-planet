/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { useEffect, useRef, useState, type RefObject } from 'react';
import { planetMapRegistry as PlanetMapRegistry } from '../../planetMapRegistry';
import { planetRenderRegistry as PlanetRenderRegistry } from '../../engine/planetRenderRegistry';
import type { CartoonPlanetUiOptions, GlobeEnginePort, Marker } from '../../types';
import { GlobeController } from '../../globeController';

export function AltitudeCoordinatesHUD({ hud }) {
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

export function FpsDebugHUD({ fps }) {
  return (
    <div className="hud hud-debug" aria-label="Frame rate">
      <div className="hud-row">
        <span className="hud-label">FPS</span>
        <span className="hud-value">{fps}</span>
      </div>
    </div>
  );
}

export function ScaleBarHUD({ hud }) {
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

export function StartLevelControl({ startView, setInitialView }) {
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

export function PlanetMapControl({ planetMap, selectPlanetMap }) {
  const maps = PlanetMapRegistry ? PlanetMapRegistry.getAll() : [];
  if (maps.length <= 1) return null;
  return (
    <div className="panel">
      <div className="panel-title">Planet map</div>
      <div className="segmented" role="group" aria-label="Planet map">
        {maps.map(map => (
          <button
            key={map.id}
            type="button"
            className={planetMap === map.id ? 'is-active' : ''}
            aria-pressed={planetMap === map.id}
            onClick={() => selectPlanetMap(map.id)}
          >
            {map.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RenderModeControl({ renderMode, selectRenderMode }) {
  return (
    <div className="panel">
      <div className="panel-title">Render mode</div>
      <div className="segmented" role="group" aria-label="Render mode">
        {PlanetRenderRegistry.getAll().map(mode => (
          <button
            key={mode.id}
            type="button"
            className={renderMode === mode.id ? 'is-active' : ''}
            aria-pressed={renderMode === mode.id}
            onClick={() => selectRenderMode(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function QuickJumpControl({ flyTo }) {
  return (
    <div className="panel">
      <div className="panel-title">Quick jump</div>
      <button onClick={() => flyTo(0, 20, 6_000_000)}>🌍 Whole planet</button>
      <button onClick={() => flyTo(-100, 40, 3_500_000)}>North America</button>
      <button onClick={() => flyTo(-60, -15, 3_500_000)}>South America</button>
      <button onClick={() => flyTo(20, 5, 3_500_000)}>Africa</button>
      <button onClick={() => flyTo(15, 50, 2_500_000)}>Europe</button>
      <button onClick={() => flyTo(100, 30, 4_500_000)}>Asia</button>
      <button onClick={() => flyTo(135, -25, 3_000_000)}>Oceania</button>
      <button onClick={() => flyTo(0, -89, 4_000_000)}>Antarctica</button>
    </div>
  );
}

export function MarkerManager({ markers, setMarkers, flyTo, placingMode, setPlacingMode, enginePortRef, linksEnabled, controller }: { markers: Marker[]; setMarkers: (m: Marker[]) => void; flyTo: (lng: number, lat: number, alt: number) => void; placingMode: boolean; setPlacingMode: (v: boolean) => void; enginePortRef: RefObject<GlobeEnginePort>; linksEnabled: boolean; controller: GlobeController }) {
  const [editorData, setEditorData] = useState(null); // { lat, lng } when form is open
  const [label, setLabel] = useState('');
  const [shape, setShape] = useState('orb');
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
    { value: '#ff5e3a', label: 'Coral' }
  ];

  useEffect(() => {
    if (!enginePortRef.current) return;
    enginePortRef.current.onGlobeClick = (lng, lat) => {
      setEditorData({ lat, lng });
      setLabel(`Marker at ${lat.toFixed(1)}°, ${lng.toFixed(1)}°`);
      setPlacingMode(false);
      setSize(0.024);
      setIsOrbital(false);
      setOrbitAlt(1.18);
      const availableNodes = markers.filter(m => !m.isOrbital);
      if (availableNodes.length >= 2) {
        setNodeA(availableNodes[0].id);
        setNodeB(availableNodes[1].id);
      } else {
        setNodeA('');
        setNodeB('');
      }
    };
    return () => {
      if (enginePortRef.current) {
        enginePortRef.current.onGlobeClick = null;
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
    const newMarker = {
      id: 'custom_' + Date.now(),
      label: label.trim() || `Marker at ${editorData.lat.toFixed(1)}°, ${editorData.lng.toFixed(1)}°`,
      lng: editorData.lng,
      lat: editorData.lat,
      shape: shape,
      color: color,
      size: Number(size),
      isOrbital: isOrbital,
      altitude: isOrbital ? Number(orbitAlt) : 1.0,
      orbitNodeA: isOrbital ? nodeA : '',
      orbitNodeB: isOrbital ? nodeB : ''
    };
    setMarkers([...markers, newMarker]);
    setEditorData(null);
  }

  function handleDelete(id) {
    setMarkers(markers.filter(m => m.id !== id));
  }

  return (
    <div className="panel">
      <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <span>Markers</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 10, textTransform: 'none', color: 'var(--hud-fg)', fontWeight: 'normal' }}>
          <input 
            type="checkbox" 
            checked={!!linksEnabled} 
            onChange={e => controller.setLinksEnabled(e.target.checked)} 
            style={{ accentColor: 'var(--accent)', cursor: 'pointer', margin: 0 }}
          />
          Link
        </label>
      </div>
      
      {!placingMode && !editorData && (
        <button 
          onClick={handleAddClick} 
          style={{ width: '100%', textAlign: 'center', marginBottom: 8, background: 'rgba(255, 94, 58, 0.12)', borderColor: 'var(--accent)' }}
        >
          ➕ Add Custom Marker
        </button>
      )}

      {placingMode && (
        <button 
          onClick={handleCancelPlacing} 
          style={{ width: '100%', textAlign: 'center', marginBottom: 8, background: 'rgba(255, 94, 58, 0.06)', borderColor: 'var(--hud-dim)' }}
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
              onChange={e => setLabel(e.target.value)}
              placeholder="Marker Label"
            />
          </div>
          
          <div className="marker-editor-row">
            <div className="marker-editor-title" style={{ fontSize: 9 }}>Shape</div>
            <div className="segmented" style={{ padding: 2, marginBottom: 0 }}>
              <button 
                type="button" 
                className={shape === 'orb' ? 'is-active' : ''} 
                onClick={() => setShape('orb')}
                style={{ padding: '3px 4px', fontSize: 10, textAlign: 'center' }}
              >
                Orb
              </button>
              <button 
                type="button" 
                className={shape === 'cube' ? 'is-active' : ''} 
                onClick={() => setShape('cube')}
                style={{ padding: '3px 4px', fontSize: 10, textAlign: 'center' }}
              >
                Cube
              </button>
              <button 
                type="button" 
                className={shape === 'bar' ? 'is-active' : ''} 
                onClick={() => setShape('bar')}
                style={{ padding: '3px 4px', fontSize: 10, textAlign: 'center' }}
              >
                Bar
              </button>
            </div>
          </div>

          <div className="marker-editor-row">
            <div className="marker-editor-title" style={{ fontSize: 9 }}>Color</div>
            <div className="marker-editor-colors">
              {colorPresets.map(preset => (
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
            <div className="marker-editor-title" style={{ fontSize: 9, display: 'flex', justifyContent: 'space-between' }}>
              <span>Size</span>
              <span>{(size * 1000).toFixed(0)} units</span>
            </div>
            <input 
              type="range" 
              min="0.01" 
              max="0.05" 
              step="0.002"
              value={size}
              onChange={e => setSize(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', margin: '4px 0' }}
            />
          </div>

          <div className="marker-editor-row">
            <div className="marker-editor-title" style={{ fontSize: 9 }}>Placement</div>
            {markers.filter(m => !m.isOrbital).length >= 2 ? (
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
                    const av = markers.filter(m => !m.isOrbital);
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
              <div style={{ color: 'var(--hud-dim)', fontSize: 9, fontStyle: 'italic', lineHeight: '1.2', marginTop: 2 }}>
                ⚠️ Orbit placement requires at least 2 existing surface markers to define the orbital plane.
              </div>
            )}
          </div>

          {isOrbital && markers.filter(m => !m.isOrbital).length >= 2 && (
            <>
              <div className="marker-editor-row" style={{ display: 'flex', flexDirection: 'row', gap: 6 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="marker-editor-title" style={{ fontSize: 8 }}>Orbit Node A</span>
                  <select 
                    value={nodeA} 
                    onChange={e => setNodeA(e.target.value)} 
                    style={{ 
                      background: 'rgba(0,0,0,0.3)', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      borderRadius: 4, 
                      color: 'var(--hud-fg)', 
                      fontSize: 10, 
                      padding: '3px 4px',
                      outline: 'none',
                      cursor: 'pointer',
                      width: '100%'
                    }}
                  >
                    {markers.filter(m => !m.isOrbital).map(m => (
                      <option key={m.id} value={m.id} style={{ background: '#0a0e1a', color: '#fff' }}>{m.label}</option>
                    ))}
                  </select>
                </div>
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="marker-editor-title" style={{ fontSize: 8 }}>Orbit Node B</span>
                  <select 
                    value={nodeB} 
                    onChange={e => setNodeB(e.target.value)} 
                    style={{ 
                      background: 'rgba(0,0,0,0.3)', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      borderRadius: 4, 
                      color: 'var(--hud-fg)', 
                      fontSize: 10, 
                      padding: '3px 4px',
                      outline: 'none',
                      cursor: 'pointer',
                      width: '100%'
                    }}
                  >
                    {markers.filter(m => !m.isOrbital).map(m => (
                      <option key={m.id} value={m.id} style={{ background: '#0a0e1a', color: '#fff' }}>{m.label}</option>
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
                <div className="marker-editor-title" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
                  <span>Orbit Altitude</span>
                  <span>{((orbitAlt - 1.0) * 6371).toFixed(0)} km</span>
                </div>
                <input 
                  type="range" 
                  min="1.08" 
                  max="1.35" 
                  step="0.01"
                  value={orbitAlt}
                  onChange={e => setOrbitAlt(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', margin: '4px 0' }}
                />
              </div>
            </>
          )}

          <div className="marker-editor-actions">
            <button className="marker-item-btn marker-editor-btn" onClick={() => setEditorData(null)}>Cancel</button>
            <button className="marker-item-btn marker-editor-btn marker-editor-btn-save" onClick={handleSave}>Save</button>
          </div>
        </div>
      )}

      {markers.length > 0 && (
        <div className="marker-list">
          {markers.map(m => (
            <div key={m.id} className="marker-item">
              <div className="marker-item-info">
                <span className="marker-swatch" style={{ background: m.color, color: m.color, width: 6, height: 6 }} />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span className="marker-item-text" title={m.label}>{m.label}</span>
                  <span className="marker-item-coords">{m.lat.toFixed(1)}°, {m.lng.toFixed(1)}°</span>
                </div>
              </div>
              <div className="marker-item-actions">
                <button className="marker-item-btn" onClick={() => flyTo(m.lng, m.lat, 1500)}>Fly</button>
                <button className="marker-item-btn marker-item-btn-delete" onClick={() => handleDelete(m.id)}>Del</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
