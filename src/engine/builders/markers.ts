/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import * as THREE from 'three';
import type { Marker } from '../../types';
import { lngLatToVec3, vec3ToLngLat, hash } from '../geo/math';
import { R_CITY } from '../constants/globeConstants';

const _cameraDir = new THREE.Vector3();
const _anchorTemp = new THREE.Vector3();
const _normalTemp = new THREE.Vector3();
const _vAxisY = new THREE.Vector3(0, 1, 0);

// Surface markers render as screen-constant "pins": a marker built at the
// reference size below appears at SCREEN_PIN_RADIUS_PX on screen at every
// altitude, with other markers scaled in proportion to their own size. This
// keeps them readable from orbit down to ~5m ground level (where they would
// otherwise be either invisible km-scale orbs or floating tens of km overhead).
const MARKER_REF_SIZE = 0.024;
const SCREEN_PIN_RADIUS_PX = 11;

/** Keep markers readable at ground level without dominating the globe. */
export function markerScaleForAltitude(altMeters: number) {
  if (altMeters >= 4_000_000) return 0.3;
  if (altMeters >= 500_000) return 0.45;
  if (altMeters >= 50_000) return 0.6;
  if (altMeters >= 5_000) return 0.8;
  if (altMeters >= 500) return 1.0;
  return 1.1;
}

export function orientToSurface(mesh, up) {
  mesh.quaternion.setFromUnitVectors(_vAxisY, up);
}

function tagVisual(mesh, baseScale = 1) {
  mesh.userData.isMarkerVisual = true;
  mesh.userData.baseScale = baseScale;
  return mesh;
}

function addPickTarget(group, position, radius) {
  const pickGeo = new THREE.SphereGeometry(radius, 8, 6);
  const pickMat = new THREE.MeshBasicMaterial({
    visible: false,
    depthWrite: false,
  });
  const pick = new THREE.Mesh(pickGeo, pickMat);
  pick.position.copy(position);
  pick.userData.isMarkerPick = true;
  group.add(pick);
  return pick;
}

/** Shared orbital plane basis used by both buildMarkerMesh and buildMarkers. */
function computeOrbitBasis(marker, allMarkers) {
  if (!marker.isOrbital || !marker.orbitNodeA || !marker.orbitNodeB) return null;
  const nodeA = allMarkers.find((m) => m.id === marker.orbitNodeA);
  const nodeB = allMarkers.find((m) => m.id === marker.orbitNodeB);
  if (!nodeA || !nodeB) return null;
  const uA = lngLatToVec3(nodeA.lng, nodeA.lat, 1).normalize();
  const uB = lngLatToVec3(nodeB.lng, nodeB.lat, 1).normalize();
  const cross = new THREE.Vector3().crossVectors(uA, uB);
  const e1 = uA;
  const e2 =
    cross.length() > 0.01
      ? new THREE.Vector3().crossVectors(cross.normalize(), e1).normalize()
      : new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), e1).normalize();
  return { e1, e2 };
}

export function buildMarkerMesh(marker, mode = 'surface', allMarkers = []) {
  const baseSize = marker.size || 0.024;
  const isCluster = !!marker.isCluster;
  const isPin = marker.shape === 'icon' || !!marker.icon;
  const size = isPin ? baseSize * 0.65 : isCluster ? Math.min(0.022, baseSize * 1.1) : baseSize;
  const height = marker.height || size * 2.8;
  const color = new THREE.Color(marker.color || '#ff5e3a');
  const alt = marker.isOrbital ? (marker.altitude || 1.18) : R_CITY;

  let up = lngLatToVec3(marker.lng, marker.lat, 1).normalize();
  let e1 = up.clone();
  let e2;

  const orbitBasis = computeOrbitBasis(marker, allMarkers);
  if (orbitBasis) {
    e1 = orbitBasis.e1;
    e2 = orbitBasis.e2;
    const startAngle = hash(marker.lat || 0, marker.lng || 0) * Math.PI * 2;
    up.copy(
      e1
        .clone()
        .multiplyScalar(Math.cos(startAngle))
        .add(e2.clone().multiplyScalar(Math.sin(startAngle)))
        .normalize()
    );
  }

  let mesh;
  let meshPos;

  if (mode === 'cyberpunk') {
    const beamHeight = 0.18;
    const beamGeo = new THREE.CylinderGeometry(0.002, 0.008, beamHeight, 8, 1, true);
    beamGeo.translate(0, beamHeight / 2, 0);
    const beamMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    mesh = tagVisual(new THREE.Mesh(beamGeo, beamMat));
    meshPos = up.clone().multiplyScalar(alt);
    mesh.position.copy(meshPos);
    orientToSurface(mesh, up);
    mesh.userData.isCyberpunkBeacon = true;
  } else if (marker.shape === 'cube') {
    const geo = new THREE.BoxGeometry(size, size, size);
    mesh = tagVisual(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color })));
    meshPos = up.clone().multiplyScalar(alt + size * 0.58);
    mesh.position.copy(meshPos);
    orientToSurface(mesh, up);
  } else if (marker.shape === 'bar') {
    const geo = new THREE.CylinderGeometry(size * 0.34, size * 0.44, height, 8);
    mesh = tagVisual(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color })));
    meshPos = up.clone().multiplyScalar(alt + height * 0.5);
    mesh.position.copy(meshPos);
    orientToSurface(mesh, up);
  } else {
    const geo = new THREE.SphereGeometry(size, isPin ? 12 : 18, isPin ? 8 : 12);
    mesh = tagVisual(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color })));
    meshPos = up.clone().multiplyScalar(alt + size * 1.15);
    mesh.position.copy(meshPos);
  }

  const group = new THREE.Group();

  if (mode === 'cyberpunk') {
    const ring1Geo = new THREE.RingGeometry(size * 0.6, size * 0.9, 32);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ring1 = tagVisual(new THREE.Mesh(ring1Geo, ring1Mat), 1);
    ring1.position.copy(up.clone().multiplyScalar(alt + 0.001));
    ring1.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
    ring1.userData.isPulsingRing = true;
    ring1.userData.pulseSpeed = 0.04;
    ring1.userData.maxScale = 2.2;
    group.add(ring1);

    const ring2Geo = new THREE.RingGeometry(size * 1.2, size * 1.3, 32);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ring2 = tagVisual(new THREE.Mesh(ring2Geo, ring2Mat), 1);
    ring2.position.copy(up.clone().multiplyScalar(alt + 0.0015));
    ring2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
    ring2.userData.isRotatingRing = true;
    ring2.userData.rotSpeed = 0.02;
    group.add(ring2);
  } else if (!isPin) {
    const haloGeo = new THREE.RingGeometry(size * 1.35, size * 1.75, 24);
    const haloMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: isCluster ? 0.5 : 0.38,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const halo = tagVisual(new THREE.Mesh(haloGeo, haloMat), 1);
    halo.position.copy(up.clone().multiplyScalar(alt + 0.001));
    halo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
    halo.userData.isHalo = true;
    group.add(halo);
  } else {
    const pinGeo = new THREE.RingGeometry(size * 0.9, size * 1.2, 16);
    const pinMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const pinRing = tagVisual(new THREE.Mesh(pinGeo, pinMat), 1);
    pinRing.position.copy(up.clone().multiplyScalar(alt + 0.001));
    pinRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
    group.add(pinRing);
  }

  group.add(mesh);
  addPickTarget(group, mesh.position.clone(), Math.max(size * 3, 0.012));

  group.userData.marker = marker;

  if (marker.isOrbital) {
    group.userData.isOrbital = true;
    group.userData.orbitLat = marker.lat;
    group.userData.orbitLngStart = marker.lng;
    group.userData.orbitAngle = hash(marker.lat, marker.lng) * Math.PI * 2;
    group.userData.orbitSpeed = 0.004 + hash(marker.lng, marker.lat) * 0.004;
    group.userData.altitude = alt;
    if (e1 && e2) {
      group.userData.orbitE1 = e1;
      group.userData.orbitE2 = e2;
    }
  }

  const labelHeight =
    isPin ? size * 2.8 : isCluster ? size * 3 : mode === 'cyberpunk' ? 0.2 : Math.max(size * 2.2, height + 0.018);
  group.userData.labelHeight = labelHeight;
  group.userData.anchor = up.clone().multiplyScalar(alt + labelHeight);
  group.userData.pickRadius = Math.max(size * 3, 0.012);
  group.renderOrder = 5;

  // Record each part's surface anchor frame so updateMarkerVisualScale can scale
  // and re-seat it per frame (see SCREEN_PIN_RADIUS_PX). Non-orbital markers are
  // pinned at radius `alt`; orbital ones are animated separately and left alone.
  group.userData.isOrbital = !!marker.isOrbital;
  group.userData.anchorRadius = alt;
  group.userData.refUp = up.clone();
  group.userData.labelHeightBase = labelHeight;
  group.userData.anchorWorld = up.clone().multiplyScalar(alt);
  for (const child of group.children) {
    if (!child.userData) child.userData = {};
    child.userData.isMarkerPart = true;
    if (child.userData.baseScale == null) child.userData.baseScale = 1;
    const radius = child.position.length();
    child.userData.baseDir = radius > 1e-9 ? child.position.clone().multiplyScalar(1 / radius) : up.clone();
    child.userData.baseRadialOffset = radius - alt;
  }

  return group;
}

export function updateMarkerVisualScale(markerGroup, altMeters, camera, screenH = 800) {
  if (!markerGroup) return;
  const items = markerGroup.userData.items || [];

  // World size that maps to SCREEN_PIN_RADIUS_PX is K * cameraDistance; dividing
  // by the marker's build size yields a per-part scale factor that holds screen
  // size constant across altitudes while preserving relative marker sizes.
  const fovRad = ((camera?.fov ?? 50) * Math.PI) / 180;
  const K = (2 * SCREEN_PIN_RADIUS_PX * Math.tan(fovRad / 2)) / Math.max(1, screenH);

  for (const item of items) {
    // Orbital markers are repositioned/animated in the render loop; keep the
    // original altitude-tiered scaling and don't fight it.
    if (item.userData?.isOrbital) {
      const factor = markerScaleForAltitude(altMeters);
      item.traverse((child) => {
        if (child.userData?.isMarkerVisual) {
          child.scale.setScalar((child.userData.baseScale ?? 1) * factor);
        }
      });
      continue;
    }

    const anchorRadius = item.userData?.anchorRadius ?? 1;
    const up = item.userData?.refUp;
    if (!up || !item.userData?.anchorWorld) continue;

    const d = camera ? camera.position.distanceTo(item.userData.anchorWorld) : 1;
    const f = (K * d) / MARKER_REF_SIZE;

    for (const child of item.children) {
      if (!child.userData?.isMarkerPart) continue;
      child.scale.setScalar((child.userData.baseScale ?? 1) * f);
      child.position
        .copy(child.userData.baseDir)
        .multiplyScalar(anchorRadius + child.userData.baseRadialOffset * f);
    }

    if (item.userData.anchor && item.userData.labelHeightBase != null) {
      item.userData.anchor.copy(up).multiplyScalar(anchorRadius + item.userData.labelHeightBase * f);
    }
  }
}

export function findMarkerFromObject(object) {
  let node = object;
  while (node) {
    if (node.userData?.marker) return node.userData.marker;
    node = node.parent;
  }
  return null;
}

export function buildMarkers(markers: Marker[] = [], mode = 'surface', linksEnabled = true) {
  const group = new THREE.Group();
  group.userData.kind = 'markers';
  group.userData.items = [];

  const linkable = markers.filter((m) => !m.isCluster);

  for (const marker of markers) {
    if (!Number.isFinite(marker.lng) || !Number.isFinite(marker.lat)) continue;
    const item = buildMarkerMesh(marker, mode, markers);
    group.add(item);
    group.userData.items.push(item);

    if (marker.isOrbital) {
      const alt = marker.altitude || 1.18;
      const orbitBasis = computeOrbitBasis(marker, markers);
      if (orbitBasis) {
        const { e1, e2 } = orbitBasis;

        const points = [];
        for (let step = 0; step <= 120; step++) {
          const theta = (step / 120) * Math.PI * 2;
          const p = e1
            .clone()
            .multiplyScalar(Math.cos(theta))
            .add(e2.clone().multiplyScalar(Math.sin(theta)))
            .multiplyScalar(alt);
          points.push(p);
        }
        const ringGeo = new THREE.BufferGeometry().setFromPoints(points);
        const ringMat = new THREE.LineBasicMaterial({
          color: new THREE.Color(marker.color || '#ff5e3a'),
          transparent: true,
          opacity: mode === 'cyberpunk' ? 0.48 : mode === 'hybrid' ? 0.38 : 0.28,
          blending: mode === 'cyberpunk' || mode === 'hybrid' ? THREE.AdditiveBlending : THREE.NormalBlending,
          depthWrite: false,
        });
        const ringLine = new THREE.Line(ringGeo, ringMat);
        ringLine.renderOrder = 2;
        group.add(ringLine);
      }
    }
  }

  if (linksEnabled && linkable.length >= 2) {
    const curves = [];
    for (let i = 0; i < linkable.length - 1; i++) {
      const a = linkable[i];
      const b = linkable[i + 1];
      if (!Number.isFinite(a.lng) || !Number.isFinite(a.lat) || !Number.isFinite(b.lng) || !Number.isFinite(b.lat))
        continue;

      const start = lngLatToVec3(a.lng, a.lat, 1.012);
      const end = lngLatToVec3(b.lng, b.lat, 1.012);
      const dist = start.distanceTo(end);
      const mid = start.clone().add(end).normalize().multiplyScalar(1.05 + dist * 0.18);
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      curves.push({
        curve,
        color: new THREE.Color(a.color || '#ff5e3a'),
      });

      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(48));
      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color(a.color || '#ff5e3a'),
        transparent: true,
        opacity: mode === 'cyberpunk' ? 0.65 : mode === 'hybrid' ? 0.55 : 0.45,
        blending: mode === 'cyberpunk' || mode === 'hybrid' ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      line.renderOrder = 3;
      group.add(line);
    }

    if (curves.length > 0 && (mode === 'cyberpunk' || mode === 'hybrid')) {
      const pCount = curves.length * 4;
      const pGeo = new THREE.BufferGeometry();
      const pPositions = new Float32Array(pCount * 3);
      const pColors = new Float32Array(pCount * 3);

      const activeParticles = [];
      for (let p = 0; p < pCount; p++) {
        const curveObj = curves[Math.floor(p / 4)];
        const t = (p % 4) / 4 + Math.random() * 0.1;
        const speed = 0.08 + Math.random() * 0.08;
        activeParticles.push({ curveObj, t, speed });

        const pos = curveObj.curve.getPointAt(t % 1.0);
        pPositions[p * 3] = pos.x;
        pPositions[p * 3 + 1] = pos.y;
        pPositions[p * 3 + 2] = pos.z;

        pColors[p * 3] = curveObj.color.r;
        pColors[p * 3 + 1] = curveObj.color.g;
        pColors[p * 3 + 2] = curveObj.color.b;
      }

      pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
      pGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));

      const pMat = new THREE.PointsMaterial({
        size: mode === 'cyberpunk' ? 5.5 : 4.0,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const pPoints = new THREE.Points(pGeo, pMat);
      pPoints.renderOrder = 4;
      group.add(pPoints);

      group.userData.particles = activeParticles;
      group.userData.pPoints = pPoints;
    }
  }

  return group;
}

export function projectMarkerLabels(markerGroup, camera, canvas) {
  if (!markerGroup) return [];
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  _cameraDir.copy(camera.position).normalize();
  const labels = [];

  for (const item of markerGroup.userData.items || []) {
    const marker = item.userData.marker;
    if (!item.userData.anchor) continue;

    _anchorTemp.copy(item.userData.anchor);
    _normalTemp.copy(_anchorTemp).normalize();
    _anchorTemp.project(camera);

    const visible =
      _normalTemp.dot(_cameraDir) > -0.08 &&
      _anchorTemp.z > -1 &&
      _anchorTemp.z < 1 &&
      _anchorTemp.x >= -1.15 &&
      _anchorTemp.x <= 1.15 &&
      _anchorTemp.y >= -1.15 &&
      _anchorTemp.y <= 1.15;

    labels.push({
      id: marker.id || marker.label || `${marker.lng},${marker.lat}`,
      label: marker.isCluster ? `${marker.clusterCount} pests` : marker.label || marker.id || 'Marker',
      color: marker.color || '#ff5e3a',
      lng: marker.lng,
      lat: marker.lat,
      isCluster: !!marker.isCluster,
      frameAltitudeM: marker.frameAltitudeM,
      x: (_anchorTemp.x * 0.5 + 0.5) * w,
      y: (-_anchorTemp.y * 0.5 + 0.5) * h,
      visible,
    });
  }
  return labels;
}
