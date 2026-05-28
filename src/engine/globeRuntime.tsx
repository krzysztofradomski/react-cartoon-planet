import {
  Children,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import type { CartoonPlanetUiOptions, GlobeEnginePort } from '../types';
import { GlobeController } from '../globeController';
import { GlobeUiFromChildren, GlobeUiFromOptions } from '../components/globeUi/GlobeUi';
import { CartoonPlanetProvider } from '../context/cartoonPlanetContext';
import { attachGlobeScene } from './scene/sceneHost';
import { CYBERPUNK_RENDER_MODE } from '../presets/builtinRenderModes';

function hasUiChildren(children: ReactNode): boolean {
  return Children.toArray(children).length > 0;
}

export function GlobeRuntime({
  controller,
  enginePortRef,
  ui,
  hasExplicitUi,
  children,
}: {
  controller: GlobeController;
  enginePortRef: RefObject<GlobeEnginePort>;
  ui: CartoonPlanetUiOptions;
  hasExplicitUi: boolean;
  children?: ReactNode;
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

  const flyTo = useCallback(
    (lng: number, lat: number, alt_m: number) => controller.flyTo(lng, lat, alt_m),
    [controller]
  );
  const setInitialView = useCallback(
    (view: typeof startView) => controller.setStartView(view),
    [controller]
  );
  const selectRenderMode = useCallback(
    (mode: typeof renderMode) => controller.setRenderMode(mode),
    [controller]
  );
  const selectPlanetMap = useCallback((mapId: string) => controller.setPlanetMap(mapId), [controller]);
  const setPlacingMode = useCallback(
    (val: boolean) => (val ? controller.startPlacing() : controller.cancelPlacing()),
    [controller]
  );

  const contextValue = useMemo(
    () => ({
      globeState,
      controller,
      enginePortRef,
      flyTo,
      setInitialView,
      selectRenderMode,
      selectPlanetMap,
      setPlacingMode,
    }),
    [
      globeState,
      controller,
      enginePortRef,
      flyTo,
      setInitialView,
      selectRenderMode,
      selectPlanetMap,
      setPlacingMode,
    ]
  );

  return (
    <div className={`root ${renderMode === CYBERPUNK_RENDER_MODE.name ? 'mode-cyberpunk' : ''}`}>
      <div ref={mountRef} className="canvas-mount" />
      <CartoonPlanetProvider value={contextValue}>
        {hasUiChildren(children) ? (
          <GlobeUiFromChildren>{children}</GlobeUiFromChildren>
        ) : hasExplicitUi ? (
          <GlobeUiFromOptions ui={ui} />
        ) : null}
      </CartoonPlanetProvider>
    </div>
  );
}
