import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type CSSProperties,
} from 'react';
import { createGlobeController } from './globeController';
import { GlobeRuntime } from './engine/globeRuntime';
import {
  DEFAULT_UI_OPTIONS,
  type CartoonPlanetController,
  CartoonPlanetInitialState,
  CartoonPlanetProps,
  CartoonPlanetUiOptions,
  GlobeEnginePort,
  GlobeState,
} from './types';
import './styles/cartoon-planet.css';

export type {
  CartoonPlanetController,
  CartoonPlanetInitialState,
  CartoonPlanetProps,
  CartoonPlanetUiOptions,
  GlobeEnginePort,
  GlobeRuntimeRef,
  GlobeState,
  HudState,
  Marker,
  MarkerLabel,
  MarkerShape,
  PlanetMapId,
  RenderModeId,
  StartViewId,
} from './types';

function mergeUiOptions(ui?: Partial<CartoonPlanetUiOptions>): CartoonPlanetUiOptions {
  return { ...DEFAULT_UI_OPTIONS, ...(ui || {}) };
}

export const CartoonPlanet = forwardRef<CartoonPlanetController, CartoonPlanetProps>(function CartoonPlanet(
  { className, style, ui, initialState, onReady, onStateChange },
  ref
) {
  const enginePortRef = useRef<GlobeEnginePort>({});
  const uiOptions = useMemo(() => mergeUiOptions(ui), [ui]);
  const initialStateKey = useMemo(() => JSON.stringify(initialState || {}), [initialState]);
  const stableInitialState = useMemo<CartoonPlanetInitialState>(
    () => JSON.parse(initialStateKey),
    [initialStateKey]
  );

  const controller = useMemo(
    () => createGlobeController(enginePortRef, stableInitialState),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- controller is created once per mount
    []
  );

  useEffect(() => {
    if (typeof stableInitialState.linksEnabled === 'boolean') {
      controller.setLinksEnabled(stableInitialState.linksEnabled);
    }
  }, [controller, stableInitialState]);

  useEffect(() => {
    if (onReady) onReady(controller);
  }, [controller, onReady]);

  useEffect(() => {
    if (!onStateChange) return;
    const unsubscribe = controller.subscribe(onStateChange);
    return () => {
      unsubscribe();
    };
  }, [controller, onStateChange]);

  useImperativeHandle(ref, () => controller, [controller]);

  const rootStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    ...style,
  };

  return (
    <div className={className} style={rootStyle}>
      <GlobeRuntime controller={controller} enginePortRef={enginePortRef} ui={uiOptions} />
    </div>
  );
});
