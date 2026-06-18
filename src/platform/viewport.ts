/* eslint-disable @typescript-eslint/no-explicit-any */
import * as THREE from 'three';

export type GlobeViewport = {
  width: number;
  height: number;
  getSize(): { width: number; height: number };
  getPixelRatio(): number;
  createRenderer(): THREE.WebGLRenderer;
  /** Element used for pointer / wheel interaction (real DOM or shim). */
  getInteractionTarget(): HTMLElement;
  observeResize(onResize: () => void): () => void;
  /** Called after each rendered frame (e.g. expo-gl `endFrameEXP`). */
  endFrame?(): void;
  disposeRenderer?(renderer: THREE.WebGLRenderer): void;
};

export function createDomViewport(mount: HTMLElement): GlobeViewport {
  return {
    width: mount.clientWidth,
    height: mount.clientHeight,
    getSize() {
      return { width: mount.clientWidth, height: mount.clientHeight };
    },
    getPixelRatio() {
      return Math.min(
        typeof window !== 'undefined' ? window.devicePixelRatio : 1,
        2,
      );
    },
    createRenderer() {
      // HMR / Strict Mode can leave a stale canvas with an existing context.
      while (mount.firstChild) {
        mount.removeChild(mount.firstChild);
      }
      const renderer = new THREE.WebGLRenderer({
        alpha: false,
        antialias: true,
        preserveDrawingBuffer: true,
        logarithmicDepthBuffer: true,
      });
      const { width, height } = this.getSize();
      renderer.setPixelRatio(this.getPixelRatio());
      renderer.setSize(width, height);
      renderer.setClearAlpha(1);
      mount.appendChild(renderer.domElement);
      return renderer;
    },
    getInteractionTarget() {
      return rendererDom(mount) ?? mount;
    },
    observeResize(onResize) {
      const onWindowResize = () => onResize();
      window.addEventListener('resize', onWindowResize);
      const resizeObserver =
        typeof ResizeObserver !== 'undefined'
          ? new ResizeObserver(onResize)
          : null;
      resizeObserver?.observe(mount);
      return () => {
        window.removeEventListener('resize', onWindowResize);
        resizeObserver?.disconnect();
      };
    },
    disposeRenderer(renderer) {
      try {
        mount.removeChild(renderer.domElement);
      } catch {
        // already removed
      }
      renderer.dispose();
    },
  };
}

function rendererDom(mount: HTMLElement): HTMLElement | null {
  return mount.querySelector('canvas') as HTMLElement | null;
}

type ExpoGlLike = {
  drawingBufferWidth: number;
  drawingBufferHeight: number;
  endFrameEXP(): void;
};

export type ExpoViewportOptions = {
  gl: ExpoGlLike;
  width: number;
  height: number;
  pixelRatio?: number;
  createRenderer: (gl: ExpoGlLike, width: number, height: number) => THREE.WebGLRenderer;
  interactionTarget: HTMLElement;
  onResize?: (width: number, height: number) => void;
};

export function createExpoViewport(options: ExpoViewportOptions): GlobeViewport {
  const {
    gl,
    width,
    height,
    pixelRatio = 1,
    createRenderer,
    interactionTarget,
    onResize,
  } = options;
  let w = width;
  let h = height;

  return {
    width: w,
    height: h,
    getSize() {
      return {
        width: gl.drawingBufferWidth || w,
        height: gl.drawingBufferHeight || h,
      };
    },
    getPixelRatio() {
      return pixelRatio;
    },
    createRenderer() {
      const size = this.getSize();
      return createRenderer(gl, size.width, size.height);
    },
    getInteractionTarget() {
      return interactionTarget;
    },
    observeResize(onResizeCb) {
      return () => {};
    },
    endFrame() {
      gl.endFrameEXP();
    },
    disposeRenderer(renderer) {
      renderer.dispose();
    },
    ...(onResize
      ? {
          setSize(nextW: number, nextH: number) {
            w = nextW;
            h = nextH;
            onResize(nextW, nextH);
          },
        }
      : {}),
  };
}

export function createTouchInteractionTarget(
  width: number,
  height: number,
) {
  const listeners = new Map<string, Set<EventListener>>();
  const target = {
    clientWidth: width,
    clientHeight: height,
    style: {},
    addEventListener(type: string, listener: EventListener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: EventListener) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(event: any) {
      listeners.get(event.type)?.forEach((listener) => listener(event));
      return true;
    },
    setPointerCapture() {},
    releasePointerCapture() {},
    getBoundingClientRect() {
      return {
        left: 0,
        top: 0,
        width,
        height,
        right: width,
        bottom: height,
        x: 0,
        y: 0,
        toJSON() {
          return {};
        },
      };
    },
    setSize(nextW: number, nextH: number) {
      target.clientWidth = nextW;
      target.clientHeight = nextH;
    },
  };
  return target as unknown as HTMLElement & {
    setSize(nextW: number, nextH: number): void;
  };
}
