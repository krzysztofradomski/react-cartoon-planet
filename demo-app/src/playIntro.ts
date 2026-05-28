import type { CartoonPlanetController } from "react-cartoon-planet";
import { START_VIEWS } from "react-cartoon-planet";

/** Total scripted intro length in ms. */
export const PLAY_INTRO_MS = 6_800;

const MODE_CYCLE_START_MS = 2_800;
const MODE_STEP_MS = 1_000;

export function playIntro(
  controller: CartoonPlanetController,
  onDone: () => void
): () => void {
  const timeouts: ReturnType<typeof setTimeout>[] = [];
  const schedule = (fn: () => void, delayMs: number) => {
    timeouts.push(setTimeout(fn, delayMs));
  };

  const ground = START_VIEWS.ground;
  const globe = START_VIEWS.globe;
  const modes = controller.getRenderModes();

  controller.stopAutoRotate();
  controller.flyTo(ground.lng, ground.lat, ground.alt_m, { duration: 0 });

  schedule(() => {
    controller.flyTo(globe.lng, globe.lat, globe.alt_m, { duration: 2_000 });
  }, 50);

  schedule(() => {
    controller.startAutoRotate({ speed: 28 });
  }, 2_000);

  modes.forEach((mode, index) => {
    schedule(() => controller.setRenderMode(mode.name), MODE_CYCLE_START_MS + index * MODE_STEP_MS);
  });

  schedule(() => {
    controller.stopAutoRotate();
    onDone();
  }, PLAY_INTRO_MS);

  return () => {
    timeouts.forEach(clearTimeout);
    controller.stopAutoRotate();
  };
}
