/**
 * Build-only ambient declarations for the optional native peer dependencies
 * (`react-native` and `expo-gl`).
 *
 * These packages are declared as *optional* peer dependencies, so they are not
 * installed in this repo. Without them, `tsc` / tsup's `.d.ts` build cannot
 * resolve the imports in `src/native/*` and fails with TS2307.
 *
 * This file is referenced by tsconfig `include` so it is available during the
 * build and typecheck, but it lives outside `src` and is never published
 * (only `dist` ships). Consumers that actually use the native target install
 * the real `react-native` / `expo-gl` packages, which provide the full types.
 *
 * Keep these minimal but accurate for the surface area used in `src/native`.
 */

declare module 'react-native' {
  import type * as React from 'react';

  export interface LayoutRectangle {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  export interface LayoutChangeEvent {
    nativeEvent: { layout: LayoutRectangle };
  }

  export interface ViewProps {
    style?: unknown;
    children?: React.ReactNode;
    onLayout?: (event: LayoutChangeEvent) => void;
    [prop: string]: unknown;
  }

  export const View: React.ComponentType<ViewProps>;

  export const StyleSheet: {
    create<T extends Record<string, unknown>>(styles: T): T;
  };
}

declare module 'expo-gl' {
  import type * as React from 'react';

  export interface ExpoWebGLRenderingContext extends WebGL2RenderingContext {
    endFrameEXP(): void;
  }

  export interface GLViewProps {
    style?: unknown;
    onContextCreate?: (gl: ExpoWebGLRenderingContext) => void;
    [prop: string]: unknown;
  }

  export const GLView: React.ComponentType<GLViewProps>;
}
