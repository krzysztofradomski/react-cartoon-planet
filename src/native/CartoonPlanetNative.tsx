import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { StyleSheet, View } from 'react-native';
import type { ExpoWebGLRenderingContext } from 'expo-gl';
import type * as THREE from 'three';

import { createGlobeController } from '../globeController';
import { BUILTIN_MAPS } from '../presets/builtinMaps';
import { SURFACE_NATIVE_RENDER_MODE } from '../presets/builtinRenderModes';
import type {
  CartoonPlanetController,
  CartoonPlanetInitialState,
  CartoonPlanetProps,
  GlobeEnginePort,
} from '../types';
import { GlobeRuntimeNative } from './GlobeRuntimeNative';

export type CreateGlRenderer = (
  gl: ExpoWebGLRenderingContext,
  width: number,
  height: number,
) => THREE.WebGLRenderer;

export type GlobeInteractionTarget = {
  dispatch: (event: {
    type: 'pointerdown' | 'pointermove' | 'pointerup' | 'wheel' | 'click';
    clientX: number;
    clientY: number;
    deltaY?: number;
    pointerId?: number;
  }) => void;
};

export type CartoonPlanetNativeProps = Omit<
  CartoonPlanetProps,
  'className' | 'style' | 'children' | 'ui'
> & {
  createGlRenderer: CreateGlRenderer;
  pixelRatio?: number;
  style?: object;
  onInteractionReady?: (interaction: GlobeInteractionTarget) => void;
};

export const CartoonPlanetNative = forwardRef<
  CartoonPlanetController,
  CartoonPlanetNativeProps
>(function CartoonPlanetNative(
  {
    createGlRenderer,
    pixelRatio,
    maps,
    renderModes,
    initialState,
    bloom = false,
    dayNight = false,
    clouds = false,
    onReady,
    onStateChange,
    onSceneReady,
    onMarkerClick,
    onMarkerHover,
    style,
    onInteractionReady,
  },
  ref,
) {
  const enginePortRef = useRef<GlobeEnginePort>({});
  const stableInitialState = useRef(initialState).current ?? {};

  const controller = useMemo(
    () =>
      createGlobeController(enginePortRef, {
        initialState: {
          ...stableInitialState,
          renderMode: stableInitialState.renderMode ?? SURFACE_NATIVE_RENDER_MODE,
          map: stableInitialState.map ?? BUILTIN_MAPS[0],
        },
        maps: maps ?? BUILTIN_MAPS,
        renderModes: renderModes ?? [SURFACE_NATIVE_RENDER_MODE],
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    onReady?.(controller);
  }, [controller, onReady]);

  useEffect(() => {
    if (!onStateChange) return;
    return controller.subscribe(onStateChange);
  }, [controller, onStateChange]);

  useImperativeHandle(ref, () => controller, [controller]);

  return (
    <View style={[styles.root, style]}>
      <GlobeRuntimeNative
        controller={controller}
        enginePortRef={enginePortRef}
        createGlRenderer={createGlRenderer}
        pixelRatio={pixelRatio}
        bloom={bloom}
        dayNight={dayNight}
        clouds={clouds}
        initialCamera={stableInitialState.initialCamera}
        onSceneReady={onSceneReady}
        onMarkerClick={onMarkerClick}
        onMarkerHover={onMarkerHover}
        onInteractionTarget={(target) => {
          onInteractionReady?.({
            dispatch(event) {
              (target as unknown as { dispatchEvent: (e: unknown) => void }).dispatchEvent({
                ...event,
                pointerId: event.pointerId ?? 1,
                preventDefault() {},
              });
            },
          });
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', height: '100%' },
});
