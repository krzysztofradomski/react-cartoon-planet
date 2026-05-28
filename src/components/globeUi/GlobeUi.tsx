import type { ReactNode } from 'react';
import type { CartoonPlanetUiOptions } from '../../types';
import {
  AltitudeDisplay,
  FpsDisplay,
  HintDisplay,
  MarkerLabelsDisplay,
  MarkerManagerControl,
  PlanetMapControl,
  PlacingToastDisplay,
  QuickJumpControl,
  RenderModeControl,
  ScaleBarDisplay,
  StartLevelControl,
} from './composables';
import { CartoonPlanetUiLayer } from '../../context/cartoonPlanetContext';

export function GlobeUiFromOptions({ ui }: { ui: CartoonPlanetUiOptions }) {
  return (
    <CartoonPlanetUiLayer>
      {ui.altitudeHud && <AltitudeDisplay />}
      {ui.scaleBar && <ScaleBarDisplay />}
      {ui.markerLabels && <MarkerLabelsDisplay />}
      {ui.placingToast && <PlacingToastDisplay />}
      {ui.hint && <HintDisplay />}
      {ui.fpsHud && <FpsDisplay />}
      {ui.startLevelControl && <StartLevelControl />}
      {ui.planetMapControl && <PlanetMapControl />}
      {ui.renderModeControl && <RenderModeControl />}
      {ui.quickJumpControl && <QuickJumpControl />}
      {ui.markerManagerControl && <MarkerManagerControl />}
    </CartoonPlanetUiLayer>
  );
}

export function GlobeUiFromChildren({ children }: { children: ReactNode }) {
  return <CartoonPlanetUiLayer>{children}</CartoonPlanetUiLayer>;
}
