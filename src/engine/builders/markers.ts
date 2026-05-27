/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import * as THREE from 'three';
import type { Marker } from '../../types';
import { lngLatToVec3, vec3ToLngLat, tangentFrame, hash } from '../geo/math';
import { R_DETAIL, R_CITY } from '../constants/globeConstants';
import { EARTH_RADIUS_M } from '../../globeController';

const _cameraDir = new THREE.Vector3();
const _anchorTemp = new THREE.Vector3();
const _normalTemp = new THREE.Vector3();
const _vAxisY = new THREE.Vector3(0, 1, 0);

export function orientToSurface(mesh, up) {
  mesh.quaternion.setFromUnitVectors(_vAxisY, up);
}

export function buildMarkerMesh(marker, mode = 'surface', allMarkers = []) {
  const size = marker.size || 0.024;
  const height = marker.height || size * 2.8;
  const color = new THREE.Color(marker.color || '#ff5e3a');
  const alt = marker.isOrbital ? (marker.altitude || 1.18) : R_CITY;
  
  let up = lngLatToVec3(marker.lng, marker.lat, 1).normalize();
  let e1 = up.clone();
  let e2;

  if (marker.isOrbital && marker.orbitNodeA && marker.orbitNodeB) {
    const nodeAObj = allMarkers.find(m => m.id === marker.orbitNodeA);
    const nodeBObj = allMarkers.find(m => m.id === marker.orbitNodeB);
    if (nodeAObj && nodeBObj) {
      const uA = lngLatToVec3(nodeAObj.lng, nodeAObj.lat, 1).normalize();
      const uB = lngLatToVec3(nodeBObj.lng, nodeBObj.lat, 1).normalize();
      const cross = new THREE.Vector3().crossVectors(uA, uB);
      e1.copy(uA);
      if (cross.length() > 0.01) {
        const normal = cross.normalize();
        e2 = new THREE.Vector3().crossVectors(normal, e1).normalize();
      } else {
        const normal = new THREE.Vector3(0, 1, 0);
        e2 = new THREE.Vector3().crossVectors(normal, e1).normalize();
      }
      const startAngle = hash(marker.lat || 0, marker.lng || 0) * Math.PI * 2;
      up.copy(e1.clone().multiplyScalar(Math.cos(startAngle)).add(e2.clone().multiplyScalar(Math.sin(startAngle))).normalize());
    }
  }
  let mesh;

  if (mode === 'cyberpunk') {
    // High-tech holographic beacon
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
    mesh = new THREE.Mesh(beamGeo, beamMat);
    mesh.position.copy(up.clone().multiplyScalar(alt));
    orientToSurface(mesh, up);
    mesh.userData.isCyberpunkBeacon = true;
    mesh.userData.baseHeight = beamHeight;
  } else {
    if (marker.shape === 'cube') {
      const geo = new THREE.BoxGeometry(size, size, size);
      const mat = new THREE.MeshBasicMaterial({ color });
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(up.clone().multiplyScalar(alt + size * 0.58));
      orientToSurface(mesh, up);
    } else if (marker.shape === 'bar') {
      const geo = new THREE.CylinderGeometry(size * 0.34, size * 0.44, height, 8);
      const mat = new THREE.MeshBasicMaterial({ color });
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(up.clone().multiplyScalar(alt + height * 0.5));
      orientToSurface(mesh, up);
    } else {
      const geo = new THREE.SphereGeometry(size, 18, 12);
      const mat = new THREE.MeshBasicMaterial({ color });
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(up.clone().multiplyScalar(alt + size * 1.15));
    }
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
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
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
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.position.copy(up.clone().multiplyScalar(alt + 0.0015));
    ring2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
    ring2.userData.isRotatingRing = true;
    ring2.userData.rotSpeed = 0.02;
    group.add(ring2);
  } else {
    const haloGeo = new THREE.RingGeometry(size * 1.35, size * 1.75, 24);
    const haloMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.copy(up.clone().multiplyScalar(alt + 0.001));
    halo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
    halo.userData.isHalo = true;
    group.add(halo);
  }

  group.add(mesh);
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

  const labelHeight = mode === 'cyberpunk' ? 0.20 : Math.max(size * 2.2, height + 0.018);
  group.userData.labelHeight = labelHeight;
  group.userData.anchor = up.clone().multiplyScalar(alt + labelHeight);
  group.renderOrder = 5;
  return group;
}

export function buildMarkers(markers: Marker[] = [], mode = 'surface', linksEnabled = true) {
  const group = new THREE.Group();
  group.userData.kind = 'markers';
  group.userData.items = [];

  for (const marker of markers) {
    if (!Number.isFinite(marker.lng) || !Number.isFinite(marker.lat)) continue;
    const item = buildMarkerMesh(marker, mode, markers);
    group.add(item);
    group.userData.items.push(item);

    if (marker.isOrbital) {
      const alt = marker.altitude || 1.18;
      const nodeA = markers.find(m => m.id === marker.orbitNodeA);
      const nodeB = markers.find(m => m.id === marker.orbitNodeB);
      if (nodeA && nodeB) {
        const uA = lngLatToVec3(nodeA.lng, nodeA.lat, 1).normalize();
        const uB = lngLatToVec3(nodeB.lng, nodeB.lat, 1).normalize();
        const cross = new THREE.Vector3().crossVectors(uA, uB);
        let e1 = uA.clone();
        let e2;
        if (cross.length() > 0.01) {
          const normal = cross.normalize();
          e2 = new THREE.Vector3().crossVectors(normal, e1).normalize();
        } else {
          const normal = new THREE.Vector3(0, 1, 0);
          e2 = new THREE.Vector3().crossVectors(normal, e1).normalize();
        }

        const points = [];
        for (let step = 0; step <= 120; step++) {
          const theta = (step / 120) * Math.PI * 2;
          const p = e1.clone().multiplyScalar(Math.cos(theta))
                      .add(e2.clone().multiplyScalar(Math.sin(theta)))
                      .multiplyScalar(alt);
          points.push(p);
        }
        const ringGeo = new THREE.BufferGeometry().setFromPoints(points);
        const ringMat = new THREE.LineBasicMaterial({
          color: new THREE.Color(marker.color || '#ff5e3a'),
          transparent: true,
          opacity: mode === 'cyberpunk' ? 0.48 : mode === 'hybrid' ? 0.38 : 0.28,
          blending: (mode === 'cyberpunk' || mode === 'hybrid') ? THREE.AdditiveBlending : THREE.NormalBlending,
          depthWrite: false
        });
        const ringLine = new THREE.Line(ringGeo, ringMat);
        ringLine.renderOrder = 2;
        group.add(ringLine);
      }
    }
  }

  if (linksEnabled && markers.length >= 2) {
    const curves = [];
    for (let i = 0; i < markers.length - 1; i++) {
      const a = markers[i];
      const b = markers[i + 1];
      if (!Number.isFinite(a.lng) || !Number.isFinite(a.lat) || !Number.isFinite(b.lng) || !Number.isFinite(b.lat)) continue;

      const start = lngLatToVec3(a.lng, a.lat, 1.012);
      const end = lngLatToVec3(b.lng, b.lat, 1.012);
      const dist = start.distanceTo(end);
      const mid = start.clone().add(end).normalize().multiplyScalar(1.05 + dist * 0.18);
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      curves.push({
        curve,
        color: new THREE.Color(a.color || '#ff5e3a')
      });

      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(48));
      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color(a.color || '#ff5e3a'),
        transparent: true,
        opacity: mode === 'cyberpunk' ? 0.65 : mode === 'hybrid' ? 0.55 : 0.45,
        blending: (mode === 'cyberpunk' || mode === 'hybrid') ? THREE.AdditiveBlending : THREE.NormalBlending,
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
      label: marker.label || marker.id || 'Marker',
      color: marker.color || '#ff5e3a',
      x: (_anchorTemp.x * 0.5 + 0.5) * w,
      y: (-_anchorTemp.y * 0.5 + 0.5) * h,
      visible,
    });
  }
  return labels;
}
