import type { RefObject } from 'react';
import type { CartoonPlanetUiOptions, GlobeEnginePort, GlobeState } from '../../types';
import { GlobeController } from '../../globeController';
import {
  AltitudeCoordinatesHUD,
  FpsDebugHUD,
  MarkerManager,
  PlanetMapControl,
  QuickJumpControl,
  RenderModeControl,
  ScaleBarHUD,
  StartLevelControl,
} from './panels';

export type GlobeUiProps = {
  ui: CartoonPlanetUiOptions;
  globeState: GlobeState;
  controller: GlobeController;
  enginePortRef: RefObject<GlobeEnginePort>;
  flyTo: (lng: number, lat: number, alt_m: number) => void;
  setInitialView: (view: GlobeState['startView']) => void;
  selectRenderMode: (mode: GlobeState['renderMode']) => void;
  selectPlanetMap: (mapId: GlobeState['planetMap']) => void;
  setPlacingMode: (val: boolean) => void;
};

export function GlobeUi({
  ui,
  globeState,
  controller,
  enginePortRef,
  flyTo,
  setInitialView,
  selectRenderMode,
  selectPlanetMap,
  setPlacingMode,
}: GlobeUiProps) {
  const { renderMode, planetMap, startView, markers, placingMode, hud, markerLabels, linksEnabled, fps } =
    globeState;

  return (
    <>
      {ui.altitudeHud && <AltitudeCoordinatesHUD hud={hud} />}
      {ui.scaleBar && <ScaleBarHUD hud={hud} />}

      {ui.markerLabels && (
        <div className="marker-layer" aria-hidden="true">
          {markerLabels.map(
            (marker) =>
              marker.visible && (
                <div
                  key={marker.id}
                  className="marker-label"
                  style={{ left: marker.x, top: marker.y }}
                >
                  <span
                    className="marker-swatch"
                    style={{ color: marker.color, background: marker.color }}
                  />
                  <span className="marker-text">{marker.label}</span>
                </div>
              )
          )}
        </div>
      )}

      <div className="hud-overlay-container">
        {ui.fpsHud && <FpsDebugHUD fps={fps} />}
        {ui.startLevelControl && (
          <StartLevelControl startView={startView} setInitialView={setInitialView} />
        )}
        {ui.planetMapControl && (
          <PlanetMapControl planetMap={planetMap} selectPlanetMap={selectPlanetMap} controller={controller} />
        )}
        {ui.renderModeControl && (
          <RenderModeControl renderMode={renderMode} selectRenderMode={selectRenderMode} controller={controller} />
        )}
        {ui.quickJumpControl && <QuickJumpControl flyTo={flyTo} />}
        {ui.markerManagerControl && (
          <MarkerManager
            markers={markers}
            setMarkers={(list) => controller.setMarkers(list)}
            flyTo={flyTo}
            placingMode={placingMode}
            setPlacingMode={setPlacingMode}
            enginePortRef={enginePortRef}
            linksEnabled={linksEnabled}
            controller={controller}
          />
        )}
      </div>

      {ui.placingToast && placingMode && (
        <div className="placing-toast">Click on the globe to place your custom marker</div>
      )}

      {ui.hint && <div className="hint">drag to pan · scroll to zoom</div>}
    </>
  );
}
