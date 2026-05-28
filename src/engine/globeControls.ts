/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import * as THREE from 'three';
import { lngLatToVec3, vec3ToLngLat } from './geo/math';
import { EARTH_RADIUS_M } from '../globeController';
import { MIN_RADIUS, MAX_RADIUS } from './constants/globeConstants';

/** Avoid a 360° spin snapping the long way when homing after a full eastward rotation. */
function resolveTargetTheta(from, to) {
  let d = to - from;
  if (Math.abs(d) < 1e-9) return to;
  if (Math.abs(Math.abs(d) - 2 * Math.PI) < 0.05) return from;
  let resolved = to;
  d = resolved - from;
  while (d > Math.PI) {
    resolved -= 2 * Math.PI;
    d = resolved - from;
  }
  while (d < -Math.PI) {
    resolved += 2 * Math.PI;
    d = resolved - from;
  }
  return resolved;
}

export class GlobeControls {
  constructor(camera, dom, onChange) {
    this.camera = camera;
    this.dom    = dom;
    this.onChange = onChange;

    // spherical coords for camera (relative to scene origin = planet center)
    this.radius = 3.2;
    this.theta  = Math.PI;            // looking at lng=0 (Africa) initially
    this.phi    = Math.PI * 0.42;
    this.targetRadius = this.radius;
    this.targetTheta  = this.theta;
    this.targetPhi    = this.phi;

    this._dragging = false;
    this._lastX = 0; this._lastY = 0;
    this._autoRotateDegPerSec = 0;
    this._lastTickMs = performance.now();

    dom.addEventListener('pointerdown', this._onDown);
    dom.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    dom.addEventListener('wheel', this._onWheel, { passive: false });
    this._update(true);
  }

  _onDown = (e) => {
    this._dragging = true;
    this._lastX = e.clientX; this._lastY = e.clientY;
    this.dom.setPointerCapture(e.pointerId);
  };

  _onUp = (e) => {
    this._dragging = false;
    try { this.dom.releasePointerCapture(e.pointerId); } catch {}
  };

  _onMove = (e) => {
    if (!this._dragging) return;
    const dx = e.clientX - this._lastX;
    const dy = e.clientY - this._lastY;
    this._lastX = e.clientX; this._lastY = e.clientY;

    // panning sensitivity scales with altitude — slower when close
    const alt = Math.max(0.00001, this.targetRadius - 1);
    const speed = alt * 0.0028;
    this.targetTheta -= dx * speed;
    this.targetPhi   -= dy * speed;
    this.targetPhi   = Math.max(0.05, Math.min(Math.PI - 0.05, this.targetPhi));
  };

  _onWheel = (e) => {
    e.preventDefault();
    // exponential zoom — smooth across 9 orders of magnitude
    const factor = Math.exp(e.deltaY * 0.0015);
    this.targetRadius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, this.targetRadius * factor));
  };

  setRadius(r) { this.targetRadius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, r)); }

  jumpTo(lng, lat, radius) {
    this.radius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, radius));
    this.theta  = (lng + 180) * Math.PI / 180;
    this.phi    = (90 - lat) * Math.PI / 180;
    this.targetRadius = this.radius;
    this.targetTheta  = this.theta;
    this.targetPhi    = this.phi;
    this._anim = null;
    this._update(true);
  }

  flyTo(lng, lat, radius, duration = 1500) {
    const phi   = (90 - lat) * Math.PI / 180;
    const theta = (lng + 180) * Math.PI / 180;
    this._animateTo(radius, theta, phi, duration);
  }

  flyToAltitude(radius, duration = 1500) {
    this._animateTo(radius, this.targetTheta, this.targetPhi, duration);
  }

  rotateBy(lngDelta, latDelta, duration = 600) {
    const theta = this.targetTheta + lngDelta * Math.PI / 180;
    const phi = Math.max(0.05, Math.min(Math.PI - 0.05, this.targetPhi - latDelta * Math.PI / 180));
    this._animateTo(this.targetRadius, theta, phi, duration);
  }

  rotateTo(lng, lat, duration = 600) {
    const phi = Math.max(0.05, Math.min(Math.PI - 0.05, (90 - lat) * Math.PI / 180));
    const theta = (lng + 180) * Math.PI / 180;
    this._animateTo(this.targetRadius, theta, phi, duration);
  }

  startAutoRotate(speedDegPerSec = 12) {
    this._autoRotateDegPerSec = speedDegPerSec;
    this._lastTickMs = performance.now();
  }

  stopAutoRotate() {
    this._autoRotateDegPerSec = 0;
  }

  getView() {
    const lng = this.targetTheta * 180 / Math.PI - 180;
    const lat = 90 - this.targetPhi * 180 / Math.PI;
    return {
      lng,
      lat,
      altitudeMeters: (this.targetRadius - 1) * EARTH_RADIUS_M,
    };
  }

  _animateTo(radius, theta, phi, duration) {
    if (duration <= 0) {
      this.radius = radius;
      this.theta = theta;
      this.phi = phi;
      this.targetRadius = radius;
      this.targetTheta = theta;
      this.targetPhi = phi;
      this._anim = null;
      this._update(true);
      return;
    }
    const toTheta = resolveTargetTheta(this.targetTheta, theta);
    this._anim = {
      t0: performance.now(),
      duration,
      from: { r: this.targetRadius, t: this.targetTheta, p: this.targetPhi },
      to: { r: radius, t: toTheta, p: phi },
    };
  }

  tick() {
    const now = performance.now();
    const dtSec = Math.min(0.1, (now - this._lastTickMs) / 1000);
    this._lastTickMs = now;

    if (this._anim) {
      const t = Math.min(1, (now - this._anim.t0) / this._anim.duration);
      const k = 1 - Math.pow(1 - t, 3);
      const { from, to } = this._anim;
      // interp radius in log space so altitude feels even
      const lr = Math.log(from.r) + (Math.log(to.r) - Math.log(from.r)) * k;
      this.targetRadius = Math.exp(lr);
      this.targetTheta  = from.t + (to.t - from.t) * k;
      this.targetPhi    = from.p + (to.p - from.p) * k;
      if (t >= 1) this._anim = null;
    }

    if (this._autoRotateDegPerSec) {
      this.targetTheta += (this._autoRotateDegPerSec * Math.PI / 180) * dtSec;
    }

    this._update(false);
  }

  _update(snap) {
    const a = snap ? 1 : 0.18;
    this.radius += (this.targetRadius - this.radius) * a;
    this.theta  += (this.targetTheta  - this.theta)  * a;
    this.phi    += (this.targetPhi    - this.phi)    * a;

    // Match the lng/lat→vec3 convention so flyTo(lng,lat) lands above the
    // correct surface point: x = -r·sin(phi)·cos(theta), z = r·sin(phi)·sin(theta)
    const x = -this.radius * Math.sin(this.phi) * Math.cos(this.theta);
    const y =  this.radius * Math.cos(this.phi);
    const z =  this.radius * Math.sin(this.phi) * Math.sin(this.theta);
    this.camera.position.set(x, y, z);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);

    const alt = Math.max(1e-7, this.radius - 1);
    this.camera.near = Math.max(1e-7, alt * 0.001);
    this.camera.far  = 200;
    this.camera.updateProjectionMatrix();

    if (this.onChange) this.onChange(this);
  }
}

// =============================================================================
// Modular Floating Controls Components
