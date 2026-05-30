/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck

const EARTH_RADIUS_M = 6_371_000;

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/** Great-circle distance between two WGS84 points in meters. */
export function haversineMeters(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const phi1 = lat1 * DEG_TO_RAD;
  const phi2 = lat2 * DEG_TO_RAD;
  const dPhi = (lat2 - lat1) * DEG_TO_RAD;
  const dLambda = (lng2 - lng1) * DEG_TO_RAD;
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Approximate meters per degree at a given latitude. */
export function metersPerDegree(lat: number) {
  const cosLat = Math.cos(lat * DEG_TO_RAD);
  return {
    lat: 111_132,
    lng: 111_132 * Math.max(0.01, cosLat),
  };
}

/** Move a point east/north along the local tangent plane (meters). */
export function offsetLngLatMeters(lng: number, lat: number, eastM: number, northM: number) {
  const scale = metersPerDegree(lat);
  return {
    lng: lng + eastM / scale.lng,
    lat: lat + northM / scale.lat,
  };
}

/** Estimate ground meters represented by one screen pixel at the current view. */
export function metersPerPixel(radius: number, camera: { fov: number }, screenW: number) {
  const altScene = radius - 1;
  if (altScene <= 0 || screenW <= 0) return 1;
  const vfov = camera.fov * DEG_TO_RAD;
  const visibleHeightM = 2 * Math.tan(vfov / 2) * altScene * EARTH_RADIUS_M;
  return visibleHeightM / screenW;
}
