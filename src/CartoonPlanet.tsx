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
import { BUILTIN_MAPS } from './presets/builtinMaps';
import { BUILTIN_RENDER_MODES } from './presets/builtinRenderModes';
import {
  DEFAULT_UI_OPTIONS,
  type CartoonPlanetController,
  type CartoonPlanetInitialState,
  type CartoonPlanetProps,
  type CartoonPlanetUiOptions,
  type GlobeEnginePort,
  type GlobeRenderModeDefinition,
  type PlanetMapDefinition,
} from './types';
import './styles/cartoon-planet.css';

export type {
  CartoonPlanetController,
  CartoonPlanetInitialState,
  CartoonPlanetProps,
  CartoonPlanetUiOptions,
  GlobeEnginePort,
  GlobeRenderConfig,
  GlobeAutoRotateOptions,
  GlobeFlyOptions,
  GlobeRenderModeDefinition,
  GlobeRotateOptions,
  GlobeRuntimeRef,
  GlobeState,
  GlobeView,
  HudState,
  Marker,
  MarkerLabel,
  MarkerShape,
  PlanetMapDefinition,
  PlanetMapOptions,
  StartViewId,
} from './types';

export {
  BUILTIN_MAPS,
  EARTH_MAP,
  MOON_MAP,
  resolveBundledAssetUrl,
} from './presets/builtinMaps';
export {
  BUILTIN_RENDER_MODES,
  SURFACE_RENDER_MODE,
  DOTS_RENDER_MODE,
  HYBRID_RENDER_MODE,
  CYBERPUNK_RENDER_MODE,
} from './presets/builtinRenderModes';
export { START_VIEWS } from './globeController';
export { DEFAULT_MARKERS, WARSAW_BUG_MARKERS } from './types';
export { flattenGeoJsonToContinents } from './catalog/mapCatalog';
export { useCartoonPlanet } from './context/cartoonPlanetContext';
export {
  AltitudeDisplay,
  FpsDisplay,
  HintDisplay,
  LinksDisplay,
  MarkerLabelsDisplay,
  MarkerManagerControl,
  OutlineStyleControl,
  PlanetMapControl,
  PlacingToastDisplay,
  QuickJumpControl,
  RenderModeControl,
  ScaleBarDisplay,
  StartLevelControl,
  CartoonPlanetDefaultUi,
} from './components/globeUi/composables';

function mergeUiOptions(ui?: Partial<CartoonPlanetUiOptions>): {
  options: CartoonPlanetUiOptions;
  hasExplicitUi: boolean;
} {
  if (!ui) {
    return { options: DEFAULT_UI_OPTIONS, hasExplicitUi: false };
  }
  return { options: { ...DEFAULT_UI_OPTIONS, ...ui }, hasExplicitUi: true };
}

function mergeMaps(maps: PlanetMapDefinition[], initial?: PlanetMapDefinition): PlanetMapDefinition[] {
  if (!initial) return maps;
  return maps.some((m) => m.name === initial.name) ? maps : [...maps, initial];
}

function mergeRenderModes(
  modes: GlobeRenderModeDefinition[],
  initial?: GlobeRenderModeDefinition
): GlobeRenderModeDefinition[] {
  if (!initial) return modes;
  return modes.some((m) => m.name === initial.name) ? modes : [...modes, initial];
}

export const CartoonPlanet = forwardRef<CartoonPlanetController, CartoonPlanetProps>(function CartoonPlanet(
  { className, style, maps, renderModes, ui, initialState, onReady, onStateChange, children },
  ref
) {
  const enginePortRef = useRef<GlobeEnginePort>({});
  const { options: uiOptions, hasExplicitUi } = useMemo(() => mergeUiOptions(ui), [ui]);
  const initialStateKey = useMemo(() => JSON.stringify(initialState || {}), [initialState]);
  const stableInitialState = useMemo<CartoonPlanetInitialState>(
    () => JSON.parse(initialStateKey),
    [initialStateKey]
  );

  const resolvedMaps = useMemo(
    () => mergeMaps(maps ?? BUILTIN_MAPS, stableInitialState.map),
    [maps, stableInitialState.map]
  );
  const resolvedRenderModes = useMemo(
    () => mergeRenderModes(renderModes ?? BUILTIN_RENDER_MODES, stableInitialState.renderMode),
    [renderModes, stableInitialState.renderMode]
  );

  const controller = useMemo(
    () =>
      createGlobeController(enginePortRef, {
        initialState: stableInitialState,
        maps: resolvedMaps,
        renderModes: resolvedRenderModes,
      }),
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
      <GlobeRuntime
        controller={controller}
        enginePortRef={enginePortRef}
        ui={uiOptions}
        hasExplicitUi={hasExplicitUi}
      >
        {children}
      </GlobeRuntime>
    </div>
  );
});
