/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import * as THREE from 'three';
import { lngLatToVec3, cleanRing, subdivideRing, outlineWidthForAltitude } from '../geo/math';
import { OCEAN_COLOR } from '../constants/globeConstants';

export { outlineWidthForAltitude };

export function drawRingOnTexture(ctx, ring, color, width, height) {
  const clean = cleanRing(ring);
  if (clean.length < 3) return;

  ctx.fillStyle = color;
  for (let offset = -360; offset <= 360; offset += 360) {
    ctx.beginPath();
    for (let i = 0; i < clean.length; i++) {
      const lng = clean[i][0] + offset;
      const lat = clean[i][1];
      const x = ((lng + 180) / 360) * width;
      const y = ((90 - lat) / 180) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
}

export function strokeRingOnTexture(ctx, ring, width, height, lineWidth, outlineColor = '#0a0a14') {
  const clean = cleanRing(ring);
  if (clean.length < 3) return;

  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (let offset = -360; offset <= 360; offset += 360) {
    ctx.beginPath();
    for (let i = 0; i < clean.length; i++) {
      const lng = clean[i][0] + offset;
      const lat = clean[i][1];
      const x = ((lng + 180) / 360) * width;
      const y = ((90 - lat) / 180) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
}

export function buildMapCanvas(continents = [], options = {}) {
  const {
    width = 4096,
    height = 2048,
    oceanColor = OCEAN_COLOR,
    landColor = '#3aa94e',
    outlinePx = 12,
    drawOutline = true,
    outlineColor = '#0a0a14',
    landGrid = false,
  } = options;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = OCEAN_COLOR;
  ctx.fillStyle = oceanColor;
  ctx.fillRect(0, 0, width, height);

  for (const continent of continents) {
    const color = landColor || continent.color || '#3aa94e';
    for (const ringDef of continent.rings || []) {
      const ring = Array.isArray(ringDef) ? ringDef : ringDef.points;
      drawRingOnTexture(ctx, ring, color, width, height);
    }
  }

  if (landGrid) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.strokeStyle = 'rgba(255, 46, 234, 0.15)';
    ctx.lineWidth = 4;
    // Draw latitude lines
    for (let lat = -90; lat <= 90; lat += 2.5) {
      const y = ((90 - lat) / 180) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    // Draw longitude lines
    for (let lng = -180; lng <= 180; lng += 2.5) {
      const x = ((lng + 180) / 360) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (drawOutline) {
    for (const continent of continents) {
      if (continent.outline === false) continue;
      for (const ringDef of continent.rings || []) {
        if (ringDef.outline === false) continue;
        const ring = Array.isArray(ringDef) ? ringDef : ringDef.points;
        strokeRingOnTexture(ctx, ring, width, height, outlinePx, outlineColor);
      }
    }
  }
  return canvas;
}

export function buildTextureSphere(canvas, radius, options = {}) {
  const {
    opacity = 1,
    transparent = false,
    color = 0xffffff,
  } = options;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  const geo = new THREE.SphereGeometry(radius, 96, 64);
  const mat = new THREE.MeshBasicMaterial({
    color,
    map: texture,
    transparent,
    opacity,
    depthTest: true,
    depthWrite: true,
    side: THREE.FrontSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 0;
  return mesh;
}
