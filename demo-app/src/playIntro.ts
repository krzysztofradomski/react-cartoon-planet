import type { CartoonPlanetController } from "react-cartoon-planet";
import { START_VIEWS } from "react-cartoon-planet";

export type IntroSnapshot = {
  lng: number;
  lat: number;
  altitudeMeters: number;
  renderMode: string;
};

const GLOBE_ALT_M = START_VIEWS.globe.alt_m;
const GROUND_LEVEL_THRESHOLD_M = 500_000;
const GO_TO_GLOBE_MS = 1_200;
const MODE_STEP_MS = 2_000;

function captureSnapshot(controller: CartoonPlanetController): IntroSnapshot {
  const view = controller.getView();
  return {
    lng: view.lng,
    lat: view.lat,
    altitudeMeters: view.altitudeMeters,
    renderMode: controller.getState().renderMode,
  };
}

function isGroundLevel(altitudeMeters: number): boolean {
  return altitudeMeters < GROUND_LEVEL_THRESHOLD_M;
}

/** Every render mode once, starting from the current mode. */
function modesInOrder(
  modes: { name: string }[],
  startMode: string
): { name: string }[] {
  const startIdx = modes.findIndex((m) => m.name === startMode);
  if (startIdx < 0) return modes;
  return [...modes.slice(startIdx), ...modes.slice(0, startIdx)];
}

export function playIntro(
  controller: CartoonPlanetController,
  onDone: () => void
): () => void {
  const snapshot = captureSnapshot(controller);
  const modes = modesInOrder(controller.getRenderModes(), snapshot.renderMode);
  const rotateDurationMs = modes.length * MODE_STEP_MS;
  const rotateSpeedDegPerSec = 360 / (rotateDurationMs / 1000);

  const needsGlobeFly = isGroundLevel(snapshot.altitudeMeters);
  const rotateStartMs = needsGlobeFly ? GO_TO_GLOBE_MS : 0;
  const playIntroMs = rotateStartMs + rotateDurationMs;

  const timeouts: ReturnType<typeof setTimeout>[] = [];
  const schedule = (fn: () => void, delayMs: number) => {
    timeouts.push(setTimeout(fn, delayMs));
  };

  const restoreSnapshot = () => {
    controller.stopAutoRotate();
    controller.setRenderMode(snapshot.renderMode);
    controller.flyTo(snapshot.lng, snapshot.lat, snapshot.altitudeMeters, { duration: 0 });
  };

  controller.stopAutoRotate();

  if (needsGlobeFly) {
    schedule(() => {
      controller.flyTo(snapshot.lng, snapshot.lat, GLOBE_ALT_M, { duration: GO_TO_GLOBE_MS });
    }, 0);
  }

  schedule(() => {
    controller.startAutoRotate({ speed: rotateSpeedDegPerSec });
  }, rotateStartMs);

  modes.forEach((mode, index) => {
    if (index === 0) return;
    schedule(
      () => controller.setRenderMode(mode.name),
      rotateStartMs + index * MODE_STEP_MS
    );
  });

  schedule(() => {
    restoreSnapshot();
    onDone();
  }, playIntroMs);

  return () => {
    timeouts.forEach(clearTimeout);
    restoreSnapshot();
  };
}

export const PLAY_INTRO_MS = GO_TO_GLOBE_MS + 4 * MODE_STEP_MS;
