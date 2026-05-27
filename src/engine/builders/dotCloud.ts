/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import * as THREE from 'three';
import { lngLatToVec3, hash } from '../geo/math';
import { R_OCEAN } from '../constants/globeConstants';
import { buildMapCanvas } from './mapCanvas';

export function buildDotCloud(continents = [], mode = 'dots') {
  const width = 1024;
  const height = 512;
  const landColor = mode === 'cyberpunk' ? '#ff2eea' : mode === 'hybrid' ? '#23f2bd' : '#42df69';
  const oceanColor = mode === 'cyberpunk' ? '#060010' : mode === 'hybrid' ? '#071223' : '#10295b';
  const canvas = buildMapCanvas(continents, {
    width,
    height,
    landColor,
    oceanColor,
    drawOutline: false,
  });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const positions = [];
  const colors = [];
  const landPoints = [];
  const land = new THREE.Color(mode === 'cyberpunk' ? '#ff42e6' : mode === 'hybrid' ? '#55ffd4' : '#6cff79');
  const ocean = new THREE.Color(mode === 'cyberpunk' ? '#00d8ff' : mode === 'hybrid' ? '#183464' : '#2f78ff');
  const hot = new THREE.Color(mode === 'cyberpunk' ? '#faff70' : '#ff80ff');

  const latStep = mode === 'cyberpunk' ? 1.6 : 2;
  for (let lat = -86; lat <= 86; lat += latStep) {
    const cosLat = Math.max(0.08, Math.cos(lat * Math.PI / 180));
    const lngStep = Math.max(mode === 'cyberpunk' ? 1.9 : 2.4, (mode === 'cyberpunk' ? 2.2 : 2.8) / cosLat);
    for (let lng = -180; lng < 180; lng += lngStep) {
      const x = Math.floor(((lng + 180) / 360) * (width - 1));
      const y = Math.floor(((90 - lat) / 180) * (height - 1));
      const i = (y * width + x) * 4;
      const isLand = mode === 'cyberpunk' ? (pixels[i] > 128) : (pixels[i + 1] > pixels[i + 2] + 12);
      if (mode === 'hybrid' && !isLand && hash(lng, lat) < 0.72) continue;
      if (mode === 'cyberpunk' && !isLand && hash(lng, lat) < 0.46) continue;

      const lift = mode === 'cyberpunk' ? 1.006 : mode === 'hybrid' ? 1.004 : 1.002;
      const v = lngLatToVec3(lng, lat, lift);
      positions.push(v.x, v.y, v.z);

      let color = isLand ? land : ocean;
      if ((mode === 'hybrid' || mode === 'cyberpunk') && isLand && hash(lng * 2.3, lat * 1.7) > (mode === 'cyberpunk' ? 0.94 : 0.965)) color = hot;
      const dim = isLand ? 1 : (mode === 'cyberpunk' ? 0.62 : mode === 'hybrid' ? 0.32 : 0.58);
      colors.push(color.r * dim, color.g * dim, color.b * dim);
      if (isLand && landPoints.length < 1400 && hash(lng * 1.9, lat * 2.1) > 0.88) {
        landPoints.push({ lng, lat });
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    vertexColors: true,
    size: mode === 'cyberpunk' ? 2.6 : mode === 'hybrid' ? 2.2 : 2.0,
    sizeAttenuation: false,
    transparent: true,
    opacity: mode === 'cyberpunk' ? 0.98 : mode === 'hybrid' ? 0.92 : 0.95,
    depthWrite: false,
    blending: mode === 'cyberpunk' ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.renderOrder = 2;
  points.userData.landPoints = landPoints;
  return points;
}

export function buildHybridArcs(landPoints = []) {
  const group = new THREE.Group();
  if (landPoints.length < 2) return group;

  const arcColors = [0x39ffd7, 0xb36cff, 0x72a7ff];
  for (let i = 0; i < 34; i++) {
    const a = landPoints[Math.floor(hash(i, 1.7) * landPoints.length)];
    const b = landPoints[Math.floor(hash(i + 19, 4.3) * landPoints.length)];
    if (!a || !b || (Math.abs(a.lng - b.lng) < 12 && Math.abs(a.lat - b.lat) < 8)) continue;
    const start = lngLatToVec3(a.lng, a.lat, 1.015);
    const end = lngLatToVec3(b.lng, b.lat, 1.015);
    const mid = start.clone().add(end).normalize().multiplyScalar(1.25 + hash(i, 9.1) * 0.32);
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(56));
    const mat = new THREE.LineBasicMaterial({
      color: arcColors[i % arcColors.length],
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.renderOrder = 3;
    group.add(line);
  }
  return group;
}

export function buildCyberpunkArcs(landPoints = []) {
  const group = new THREE.Group();
  if (landPoints.length < 2) return group;

  const curves = [];
  const arcColors = [0xff2eea, 0x00f5ff, 0xfaff70, 0x7c5cff];
  const arcColorsTHREE = arcColors.map(c => new THREE.Color(c));

  for (let i = 0; i < 58; i++) {
    const a = landPoints[Math.floor(hash(i * 2.1, 11.7) * landPoints.length)];
    const b = landPoints[Math.floor(hash(i + 41, 8.3) * landPoints.length)];
    if (!a || !b || (Math.abs(a.lng - b.lng) < 10 && Math.abs(a.lat - b.lat) < 8)) continue;
    const start = lngLatToVec3(a.lng, a.lat, 1.02);
    const end = lngLatToVec3(b.lng, b.lat, 1.02);
    const mid = start.clone().add(end).normalize().multiplyScalar(1.34 + hash(i, 19.1) * 0.5);
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    curves.push({
      curve,
      color: arcColorsTHREE[i % arcColorsTHREE.length],
    });

    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(64));
    const mat = new THREE.LineBasicMaterial({
      color: arcColors[i % arcColors.length],
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.renderOrder = 4;
    group.add(line);
  }

  // Create flying particles
  if (curves.length > 0) {
    const pCount = 50;
    const pGeo = new THREE.BufferGeometry();
    const pPositions = new Float32Array(pCount * 3);
    const pColors = new Float32Array(pCount * 3);
    
    const activeParticles = [];
    for (let p = 0; p < pCount; p++) {
      const curveObj = curves[Math.floor(Math.random() * curves.length)];
      const t = Math.random();
      const speed = 0.12 + Math.random() * 0.18;
      activeParticles.push({ curveObj, t, speed });
      
      const pos = curveObj.curve.getPointAt(t);
      pPositions[p*3] = pos.x;
      pPositions[p*3+1] = pos.y;
      pPositions[p*3+2] = pos.z;
      
      pColors[p*3] = curveObj.color.r;
      pColors[p*3+1] = curveObj.color.g;
      pColors[p*3+2] = curveObj.color.b;
    }
    
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));
    
    const pMat = new THREE.PointsMaterial({
      size: 4.5,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    
    const pPoints = new THREE.Points(pGeo, pMat);
    pPoints.renderOrder = 5;
    group.add(pPoints);
    
    // Store data for animation in tick
    group.userData.particles = activeParticles;
    group.userData.pPoints = pPoints;
  }

  return group;
}

export function buildCyberpunkRings() {
  const group = new THREE.Group();
  group.userData.isCyberpunkRings = true;

  const ringSpecs = [
    { lat: 0, color: 0xff2eea, opacity: 0.5, width: 1.012 },
    { lat: 28, color: 0x00f5ff, opacity: 0.28, width: 1.018 },
    { lat: -32, color: 0x7c5cff, opacity: 0.3, width: 1.016 },
  ];

  for (const spec of ringSpecs) {
    const points = [];
    for (let lng = -180; lng <= 180; lng += 3) {
      points.push(lngLatToVec3(lng, spec.lat, spec.width));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: spec.color,
      transparent: true,
      opacity: spec.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.renderOrder = 3;
    group.add(line);
  }

  const wireGeo = new THREE.SphereGeometry(1.028, 24, 16);
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x00f5ff,
    wireframe: true,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const wire = new THREE.Mesh(wireGeo, wireMat);
  wire.renderOrder = 1;
  group.add(wire);

  // Scanner Laser Line
  const scannerPoints = [];
  for (let i = 0; i <= 96; i++) {
    const theta = (i / 96) * Math.PI * 2;
    scannerPoints.push(new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)));
  }
  const scannerGeo = new THREE.BufferGeometry().setFromPoints(scannerPoints);
  const scannerMat = new THREE.LineBasicMaterial({
    color: 0x00f5ff,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const scanner = new THREE.Line(scannerGeo, scannerMat);
  scanner.userData.isScanner = true;
  scanner.renderOrder = 4;
  group.add(scanner);

  return group;
}
