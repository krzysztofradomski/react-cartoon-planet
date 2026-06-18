import {
  useCallback,
  useEffect,
  useRef,
  type RefObject,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import type * as THREE from 'three';

import type {
  CartoonPlanetBloomOptions,
  GlobeEnginePort,
  Marker,
  StartViewId,
} from '../types';
import { GlobeController } from '../globeController';
import { attachGlobeScene } from '../engine/scene/sceneHost';
import {
  createExpoViewport,
  createTouchInteractionTarget,
} from '../platform/viewport';

type ExpoGlLike = Pick<
  ExpoWebGLRenderingContext,
  'drawingBufferWidth' | 'drawingBufferHeight' | 'endFrameEXP'
>;

type Props = {
  controller: GlobeController;
  enginePortRef: RefObject<GlobeEnginePort>;
  createGlRenderer: (
    gl: ExpoWebGLRenderingContext,
    width: number,
    height: number,
  ) => THREE.WebGLRenderer;
  pixelRatio?: number;
  bloom?: boolean | CartoonPlanetBloomOptions;
  dayNight?: boolean;
  clouds?: boolean;
  initialCamera?: { lng: number; lat: number; alt_m: number };
  onSceneReady?: Parameters<typeof attachGlobeScene>[0]['onSceneReady'];
  onMarkerClick?: (marker: Marker) => boolean | void;
  onMarkerHover?: (marker: Marker | null) => void;
  onInteractionTarget?: (target: HTMLElement) => void;
};

export function GlobeRuntimeNative({
  controller,
  enginePortRef,
  createGlRenderer,
  pixelRatio = 1,
  bloom = false,
  dayNight = false,
  clouds = false,
  initialCamera,
  onSceneReady,
  onMarkerClick,
  onMarkerHover,
  onInteractionTarget,
}: Props) {
  const layoutRef = useRef({ width: 1, height: 1 });
  const startViewRef = useRef<StartViewId>(controller.getState().startView);
  const initialCameraRef = useRef(initialCamera);
  const onSceneReadyRef = useRef(onSceneReady);
  const onMarkerClickRef = useRef(onMarkerClick);
  const onMarkerHoverRef = useRef(onMarkerHover);
  const interactionRef = useRef(createTouchInteractionTarget(1, 1));
  const teardownRef = useRef<(() => void) | null>(null);
  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
    onMarkerHoverRef.current = onMarkerHover;
  });

  const mountScene = useCallback(
    (gl: ExpoWebGLRenderingContext) => {
      teardownRef.current?.();
      glRef.current = gl;

      const { width, height } = layoutRef.current;
      interactionRef.current.setSize(width, height);
      onInteractionTarget?.(interactionRef.current);

      const viewport = createExpoViewport({
        gl: gl as ExpoGlLike,
        width,
        height,
        pixelRatio,
        createRenderer: (expoGl, rw, rh) =>
          createGlRenderer(gl, rw, rh),
        interactionTarget: interactionRef.current,
      });

      teardownRef.current = attachGlobeScene({
        viewport,
        enginePortRef,
        controller,
        startView: startViewRef.current,
        initialCamera: initialCameraRef.current,
        bloom,
        dayNight,
        clouds,
        onSceneReady: onSceneReadyRef.current,
      });

      if (!enginePortRef.current) enginePortRef.current = {};
      enginePortRef.current.onMarkerClick = (marker) =>
        onMarkerClickRef.current?.(marker);
      enginePortRef.current.onMarkerHover = (marker) =>
        onMarkerHoverRef.current?.(marker);
    },
    [
      bloom,
      clouds,
      controller,
      createGlRenderer,
      dayNight,
      enginePortRef,
      onInteractionTarget,
      pixelRatio,
    ],
  );

  const onContextCreate = useCallback(
    (gl: ExpoWebGLRenderingContext) => {
      mountScene(gl);
    },
    [mountScene],
  );

  useEffect(() => {
    return () => {
      teardownRef.current?.();
      teardownRef.current = null;
    };
  }, []);

  return (
    <View
      style={styles.fill}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width <= 0 || height <= 0) return;
        layoutRef.current = { width, height };
        interactionRef.current.setSize(width, height);
        if (glRef.current) mountScene(glRef.current);
      }}
    >
      <GLView style={styles.fill} onContextCreate={onContextCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%', height: '100%' },
});
