import { useEffect, useRef, useState, type RefObject } from 'react';
import type { CartoonPlanetUiOptions, GlobeEnginePort } from '../types';
import { GlobeController } from '../globeController';
import { GlobeUi } from '../components/globeUi/GlobeUi';
import { attachGlobeScene } from './scene/sceneHost';
import { CYBERPUNK_RENDER_MODE } from '../presets/builtinRenderModes';

export function GlobeRuntime({
  controller,
  enginePortRef,
  ui,
}: {
  controller: GlobeController;
  enginePortRef: RefObject<GlobeEnginePort>;
  ui: CartoonPlanetUiOptions;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [globeState, setGlobeState] = useState(() => controller.getState());

  useEffect(() => controller.subscribe(setGlobeState), [controller]);

  const { renderMode, startView, placingMode } = globeState;

  useEffect(() => {
    if (enginePortRef.current) {
      enginePortRef.current.isPlacingMode = placingMode;
    }
  }, [placingMode, enginePortRef]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    return attachGlobeScene({
      mount,
      enginePortRef,
      controller,
      startView,
    });
  }, [controller, enginePortRef, startView]);

  const flyTo = (lng: number, lat: number, alt_m: number) => controller.flyTo(lng, lat, alt_m);
  const setInitialView = (view: typeof startView) => controller.setStartView(view);
  const selectRenderMode = (mode: typeof renderMode) => controller.setRenderMode(mode);
  const selectPlanetMap = (mapId: string) => controller.setPlanetMap(mapId);
  const setPlacingMode = (val: boolean) => (val ? controller.startPlacing() : controller.cancelPlacing());

  return (
    <div className={`root ${renderMode === CYBERPUNK_RENDER_MODE.name ? 'mode-cyberpunk' : ''}`}>
      <div ref={mountRef} className="canvas-mount" />
      <GlobeUi
        ui={ui}
        globeState={globeState}
        controller={controller}
        enginePortRef={enginePortRef}
        flyTo={flyTo}
        setInitialView={setInitialView}
        selectRenderMode={selectRenderMode}
        selectPlanetMap={selectPlanetMap}
        setPlacingMode={setPlacingMode}
      />
    </div>
  );
}
