/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { EARTH_RADIUS_M } from '../../globeController';

export function formatAltitude(m) {
  if (m >= 1_000_000) return (m / 1_000_000).toFixed(1) + ' Mm';
  if (m >= 1000)      return (m / 1000).toFixed(m < 10_000 ? 1 : 0) + ' km';
  if (m >= 1)         return m.toFixed(1) + ' m';
  return (m * 100).toFixed(0) + ' cm';
}

export function formatScaleBar(radius, camera, screenW) {
  // pick a "round" length that's roughly 1/6 of screen width
  const alt = (radius - 1);
  // How many meters per pixel approximately?
  const vfov = camera.fov * Math.PI / 180;
  const visibleHeight = 2 * Math.tan(vfov/2) * alt; // in scene units (≈ radians)
  const m_per_pixel   = (visibleHeight * EARTH_RADIUS_M) / screenW * (screenW / (screenW * 0.6));
  // simplified
  const targetPx = 160;
  const target_m = m_per_pixel * targetPx;

  const niceVals_m = [1, 2, 5, 10, 20, 50, 100, 200, 500,
                      1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000, 200_000, 500_000,
                      1_000_000, 2_000_000, 5_000_000, 10_000_000];
  let chosen = niceVals_m[0];
  for (const v of niceVals_m) if (v <= target_m) chosen = v;
  const px = chosen / m_per_pixel;
  const label = chosen >= 1000 ? (chosen/1000) + ' km' : chosen + ' m';
  return { px: Math.max(40, Math.min(screenW * 0.4, px)), label };
}


