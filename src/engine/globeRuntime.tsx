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
import type {
  CartoonPlanetBloomOptions,
  CartoonPlanetThree,
  CartoonPlanetUiOptions,
  GlobeEnginePort,
  Marker,
  StartViewId,
} from '../types';
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
  bloom,
  onSceneReady,
  onMarkerClick,
  onMarkerHover,
  children,
}: {
  controller: GlobeController;
  enginePortRef: RefObject<GlobeEnginePort>;
  ui: CartoonPlanetUiOptions;
  hasExplicitUi: boolean;
  bloom?: boolean | CartoonPlanetBloomOptions;
  onSceneReady?: (three: CartoonPlanetThree) => void;
  onMarkerClick?: (marker: Marker) => boolean | void;
  onMarkerHover?: (marker: Marker | null) => void;
  children?: ReactNode;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [globeState, setGlobeState] = useState(() => controller.getState());
  // Capture these at mount so that later changes don't tear down and rebuild the
  // entire Three.js scene. startView is only used for the initial camera jumpTo;
  // subsequent setStartView() calls already invoke flyTo directly. onSceneReady
  // fires once after mount and is never re-invoked.
  const startViewRef = useRef(globeState.startView);
  const onSceneReadyRef = useRef(onSceneReady);
  const initialBloomRef = useRef(bloom);
  // Latest-callback refs so the engine always calls the current handler without
  // re-binding (or worse, re-attaching the scene) on every parent render.
  const onMarkerClickRef = useRef(onMarkerClick);
  const onMarkerHoverRef = useRef(onMarkerHover);

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
    onMarkerHoverRef.current = onMarkerHover;
  });

  useEffect(() => controller.subscribe(setGlobeState), [controller]);

  const { renderMode, placingMode } = globeState;

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
      startView: startViewRef.current,
      bloom: initialBloomRef.current,
      onSceneReady: onSceneReadyRef.current,
    });
  }, [controller, enginePortRef]);

  useEffect(() => {
    if (!enginePortRef.current) enginePortRef.current = {};
    enginePortRef.current.onMarkerClick = (marker: Marker) => onMarkerClickRef.current?.(marker);
    enginePortRef.current.onMarkerHover = (marker: Marker | null) => onMarkerHoverRef.current?.(marker);
  }, [enginePortRef]);

  useEffect(() => {
    enginePortRef.current?.setBloom?.(bloom);
  }, [bloom, enginePortRef]);

  const flyTo = useCallback(
    (lng: number, lat: number, alt_m: number) => controller.flyTo(lng, lat, alt_m),
    [controller]
  );
  const setInitialView = useCallback(
    (view: StartViewId) => controller.setStartView(view),
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
