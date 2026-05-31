/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import * as THREE from 'three';
import { GlobeControls } from '../globeControls';
import { buildPlanetSurface } from '../builders/planetSurface';
import { buildStarfield } from '../builders/starfield';
import { buildMarkers, orientToSurface, projectMarkerLabels, findMarkerFromObject, updateMarkerVisualScale } from '../builders/markers';
import { resolveDisplayMarkers } from '../markers/markerDisplay';
import { updateContinentOutlineResolution } from '../builders/continentOutline';
import { metersPerPixel } from '../geo/distance';
import { vec3ToLngLat, hash } from '../geo/math';
import { R_LAND } from '../constants/globeConstants';
import { EARTH_RADIUS_M, START_VIEWS, GlobeController } from '../../globeController';
import type { StartViewId } from '../../types';
import { formatAltitude, formatScaleBar } from '../../components/globeUi/hudFormat';
import { bindEnginePort, clearEnginePort, type GlobeEnginePortRef } from '../globeEnginePort';

const _vOrb1 = new THREE.Vector3();
const _vOrb2 = new THREE.Vector3();
const _vOrbUp = new THREE.Vector3();
const _vOrbPos = new THREE.Vector3();
const _qOrb = new THREE.Quaternion();
const _vAxisZ = new THREE.Vector3(0, 0, 1);
const _placeSphere = new THREE.Sphere(undefined, R_LAND);
const _placeHit = new THREE.Vector3();

function disposeObject3D(child) {
  child.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      materials.forEach((m) => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
}

export type AttachGlobeSceneOptions = {
  mount: HTMLElement;
  enginePortRef: GlobeEnginePortRef;
  controller: GlobeController;
  startView: StartViewId;
};

export function attachGlobeScene({
  mount,
  enginePortRef,
  controller,
  startView,
}: AttachGlobeSceneOptions): () => void {
  const w = mount.clientWidth;
  const h = mount.clientHeight;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a0e1a');

  const camera = new THREE.PerspectiveCamera(50, w / h, 0.001, 200);

  const renderer = new THREE.WebGLRenderer({
    alpha: false,
    antialias: true,
    preserveDrawingBuffer: true,
    logarithmicDepthBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  renderer.setClearAlpha(1);
  mount.appendChild(renderer.domElement);

  const planet = new THREE.Group();
  const surfaceGroup = new THREE.Group();
  surfaceGroup.userData.kind = 'surface';
  planet.add(surfaceGroup);

  const markerRoot = new THREE.Group();
  markerRoot.userData.kind = 'markers-root';
  planet.add(markerRoot);

  const continentsGroup = new THREE.Group();
  continentsGroup.userData.kind = 'continents';
  planet.add(continentsGroup);

  const { mapCatalog, renderCatalog } = controller;

  function getMapOptions() {
    return mapCatalog.getOptions();
  }

  function currentRenderModeName(): string {
    return surfaceGroup.userData.mode || controller.getState().renderMode;
  }

  let lastMarkerDisplayKey = '';

  function markerDisplayKey(rawMarkers, altM, mpp) {
    // Only rebuild when the resolved set can actually change: entering the
    // ground "spread" regime, or crossing an octave of meters-per-pixel (which
    // is what drives cluster membership). Per-frame size/position is handled by
    // updateMarkerVisualScale, so we must NOT key on raw altitude/mpp — doing so
    // rebuilt geometry almost every frame during a fly and starved the camera
    // animation, making zoom-to-ground crawl.
    if (altM <= 80_000) return `${rawMarkers.length}:spread`;
    const mppOctave = Math.round(Math.log2(Math.max(1, mpp)));
    return `${rawMarkers.length}:cluster:${mppOctave}`;
  }

  let controls;

  function getViewMetrics() {
    const screenW = renderer.domElement.clientWidth || 800;
    if (controls) {
      const altM = (controls.radius - 1) * EARTH_RADIUS_M;
      return { altM, mpp: metersPerPixel(controls.radius, camera, screenW) };
    }
    const start = START_VIEWS[startView] || START_VIEWS.globe;
    return { altM: start.alt_m, mpp: start.alt_m / screenW };
  }

  function rebuildMarkers(
    nextMarkers = controller.getState().markers,
    modeName = currentRenderModeName(),
    altM,
    mpp
  ) {
    const metrics = getViewMetrics();
    const resolvedAlt = altM ?? metrics.altM;
    const resolvedMpp = mpp ?? metrics.mpp;
    while (markerRoot.children.length) {
      const child = markerRoot.children.pop();
      disposeObject3D(child);
    }
    const modeObj = renderCatalog.get(modeName);
    const markerMode = modeObj?.getMarkerMode ? modeObj.getMarkerMode() : 'surface';
    const displayMarkers = resolveDisplayMarkers(nextMarkers, resolvedAlt, resolvedMpp);
    lastMarkerDisplayKey = markerDisplayKey(nextMarkers, resolvedAlt, resolvedMpp);
    const markerGroup = buildMarkers(displayMarkers, markerMode, controller.getState().linksEnabled);
    markerRoot.add(markerGroup);
    markerRoot.userData.markerGroup = markerGroup;
  }

  function rebuildSurface(
    outlinePx = surfaceGroup.userData.outlinePx || 12,
    modeName: string = currentRenderModeName()
  ) {
    while (surfaceGroup.children.length) {
      const child = surfaceGroup.children.pop();
      disposeObject3D(child);
    }
    surfaceGroup.userData.outlinePx = outlinePx;
    surfaceGroup.userData.mode = modeName;
    const fatOutlines = !!controller.getState().fatOutlines;
    surfaceGroup.userData.fatOutlines = fatOutlines;
    const continents = mapCatalog.getContinents();
    const mapOpts = getMapOptions();
    surfaceGroup.add(
      buildPlanetSurface(
        renderCatalog,
        modeName,
        continents,
        outlinePx,
        { ...mapOpts, name: mapCatalog.getActiveName() },
        { fatOutline: fatOutlines }
      )
    );
    syncOutlineResolution();

    rebuildMarkers(controller.getState().markers, modeName);
  }

  function syncOutlineResolution() {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    updateContinentOutlineResolution(surfaceGroup, size.x, size.y);
  }

  function rebuildContinents() {
    rebuildSurface();
    while (continentsGroup.children.length) {
      const child = continentsGroup.children.pop();
      disposeObject3D(child);
    }
  }

  rebuildContinents();
  rebuildMarkers();

  const loadMap = () => mapCatalog.loadActive();
  scene.add(planet);

  const atmoGeo = new THREE.SphereGeometry(1.06, 64, 48);
  const atmoMat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color(0.45, 0.7, 1.0) },
    },
    vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
    fragmentShader: `
        uniform vec3 uColor;
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.7 - dot(vNormal, vec3(0,0,1.0)), 2.0);
          gl_FragColor = vec4(uColor, 1.0) * intensity;
        }`,
  });
  const atmo = new THREE.Mesh(atmoGeo, atmoMat);
  scene.add(atmo);

  function applyMapAtmosphere() {
    const mapOpts = getMapOptions();
    const strength = mapOpts.atmosphereStrength != null ? mapOpts.atmosphereStrength : 1;
    atmoMat.uniforms.uColor.value.set(mapOpts.atmosphereColor || '#73b3ff');
    atmo.userData.strength = strength;
  }
  applyMapAtmosphere();

  if (loadMap) {
    loadMap()
      .then(() => {
        rebuildContinents();
        applyMapAtmosphere();
      })
      .catch((err) => console.warn('Planet map data fetch failed; using fallback.', err));
  }

  function onPlanetMapChanged() {
    rebuildContinents();
    applyMapAtmosphere();
  }
  const unsubscribeMap = mapCatalog.onChange(onPlanetMapChanged);

  const stars = buildStarfield();
  scene.add(stars);

  const controlsInstance = new GlobeControls(camera, renderer.domElement);
  controls = controlsInstance;
  const initialView = START_VIEWS[startView] || START_VIEWS.globe;
  controlsInstance.jumpTo(initialView.lng, initialView.lat, 1 + initialView.alt_m / EARTH_RADIUS_M);

  bindEnginePort(enginePortRef, {
    controls: controlsInstance,
    setRenderMode: (mode) => rebuildSurface(surfaceGroup.userData.outlinePx || 12, mode),
    rebuildPlanetMap: () => {
      rebuildContinents();
      applyMapAtmosphere();
    },
    setMarkers: (nextMarkers) => {
      const list = Array.isArray(nextMarkers) ? nextMarkers : [];
      const { altM, mpp } = getViewMetrics();
      rebuildMarkers(list, surfaceGroup.userData.mode, altM, mpp);
    },
  });

  function handleMarkerPick(marker) {
    if (!marker) return;
    if (marker.isCluster) {
      controller.flyTo(marker.lng, marker.lat, marker.frameAltitudeM ?? 450);
      return;
    }
    controller.flyToMarker(marker.id);
  }

  function handleCanvasClick(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    if (!enginePortRef.current?.isPlacingMode) {
      const markerGroup = markerRoot.userData.markerGroup;
      if (markerGroup) {
        const markerHits = raycaster.intersectObjects(markerGroup.children, true);
        for (const hit of markerHits) {
          const marker = findMarkerFromObject(hit.object);
          if (marker) {
            handleMarkerPick(marker);
            return;
          }
        }
      }
      return;
    }

    // Analytic ray↔unit-sphere intersection gives the exact lng/lat under the
    // cursor at any altitude (precise to the surface even at ~5m ground level).
    // To place precisely between markers that are metres apart, zoom in — at
    // altitude one pixel spans kilometres, so there is no sub-pixel "between".
    if (raycaster.ray.intersectSphere(_placeSphere, _placeHit)) {
      const { lng, lat } = vec3ToLngLat(_placeHit);
      if (enginePortRef.current?.onGlobeClick) {
        enginePortRef.current.onGlobeClick(lng, lat);
      }
    }
  }
  renderer.domElement.addEventListener('click', handleCanvasClick);

  function onResize() {
    const rw = mount.clientWidth;
    const rh = mount.clientHeight;
    renderer.setSize(rw, rh);
    camera.aspect = rw / rh;
    camera.updateProjectionMatrix();
    syncOutlineResolution();
  }
  window.addEventListener('resize', onResize);

  const unsubscribeState = controller.subscribe((state) => {
    if (
      state.renderMode !== surfaceGroup.userData.mode ||
      !!state.fatOutlines !== !!surfaceGroup.userData.fatOutlines
    ) {
      rebuildSurface(surfaceGroup.userData.outlinePx || 12, state.renderMode);
    }
  });

  let raf;
  let fpsFrameCount = 0;
  let fpsLastSample = performance.now();
  let fpsSmoothed = 0;

  function tick() {
    fpsFrameCount++;
    const fpsNow = performance.now();
    const fpsElapsed = fpsNow - fpsLastSample;
    if (fpsElapsed >= 500) {
      // Smooth across samples so a single stalled window (GC pause, marker
      // rebuild, or an external GPU readback) doesn't flash a misleading number.
      const instant = (fpsFrameCount * 1000) / fpsElapsed;
      fpsSmoothed = fpsSmoothed > 0 ? fpsSmoothed * 0.6 + instant * 0.4 : instant;
      fpsFrameCount = 0;
      fpsLastSample = fpsNow;
      controller.updateFps(Math.round(fpsSmoothed));
    }
    try {
      controlsInstance.tick();
      const alt = (controlsInstance.radius - 1) * EARTH_RADIUS_M;
      // Coastlines are screen-width vector lines now, so the surface no longer
      // needs regenerating as altitude changes.

      const screenW = renderer.domElement.clientWidth || 800;
      const mpp = metersPerPixel(controlsInstance.radius, camera, screenW);
      const rawMarkers = controller.getState().markers;
      const nextMarkerKey = markerDisplayKey(rawMarkers, alt, mpp);
      if (nextMarkerKey !== lastMarkerDisplayKey) {
        rebuildMarkers(rawMarkers, surfaceGroup.userData.mode, alt, mpp);
      }

      updateMarkerVisualScale(
        markerRoot.userData.markerGroup,
        alt,
        camera,
        renderer.domElement.clientHeight || 800
      );

      const dir = camera.position.clone().normalize();
      const surface = dir.clone().multiplyScalar(1.0);
      const { lat, lng } = vec3ToLngLat(surface);

      const atmoStrength = atmo.userData.strength != null ? atmo.userData.strength : 1;
      atmoMat.opacity = THREE.MathUtils.clamp((alt / 1_000_000) * atmoStrength, 0, 1);
      stars.material.opacity = THREE.MathUtils.clamp(alt / 8_000_000, 0, 1);
      stars.material.transparent = true;

      const currentMode = surfaceGroup.userData.mode;
      const modeObj = renderCatalog.get(currentMode);
      const modeAtmo = modeObj?.getAtmosphereColor
        ? modeObj.getAtmosphereColor()
        : new THREE.Color(0.45, 0.7, 1.0);
      const mapAtmo = new THREE.Color(getMapOptions().atmosphereColor || '#73b3ff');
      atmoMat.uniforms.uColor.value.copy(modeAtmo).lerp(mapAtmo, 0.35);

      renderCatalog.animate(currentMode, surfaceGroup, { alt, time: performance.now() });

      markerRoot.traverse((child) => {
        if (child.userData) {
          if (child.userData.isOrbital && child.userData.orbitE1 && child.userData.orbitE2) {
            child.userData.orbitAngle += child.userData.orbitSpeed * 0.18;
            const theta = child.userData.orbitAngle;
            const e1 = child.userData.orbitE1;
            const e2 = child.userData.orbitE2;
            const orbitalAlt = child.userData.altitude;

            _vOrb1.copy(e1).multiplyScalar(Math.cos(theta));
            _vOrb2.copy(e2).multiplyScalar(Math.sin(theta));
            _vOrbUp.addVectors(_vOrb1, _vOrb2).normalize();

            child.children.forEach((sub) => {
              if (sub.userData.isPulsingRing || sub.userData.isRotatingRing || sub.userData.isHalo) {
                _vOrbPos.copy(_vOrbUp).multiplyScalar(orbitalAlt + 0.001);
                sub.position.copy(_vOrbPos);
                _qOrb.setFromUnitVectors(_vAxisZ, _vOrbUp);
                sub.quaternion.copy(_qOrb);
              } else {
                let offset = 0;
                if (child.userData.marker.shape === 'cube') offset = child.userData.marker.size * 0.58;
                else if (child.userData.marker.shape === 'bar')
                  offset = (child.userData.marker.height || child.userData.marker.size * 2.8) * 0.5;
                else offset = child.userData.marker.size * 1.15;

                if (sub.userData.isCyberpunkBeacon) offset = 0;

                _vOrbPos.copy(_vOrbUp).multiplyScalar(orbitalAlt + offset);
                sub.position.copy(_vOrbPos);
                orientToSurface(sub, _vOrbUp);
              }
            });

            const labelHeight = child.userData.labelHeight;
            _vOrbPos.copy(_vOrbUp).multiplyScalar(orbitalAlt + labelHeight);
            child.userData.anchor.copy(_vOrbPos);
          }

          if (child.userData.isPulsingRing) {
            if (!child.userData.scaleVal) child.userData.scaleVal = 1.0;
            child.userData.scaleVal += child.userData.pulseSpeed;
            if (child.userData.scaleVal > child.userData.maxScale) {
              child.userData.scaleVal = 0.5;
            }
            child.scale.set(child.userData.scaleVal, child.userData.scaleVal, 1);
            child.material.opacity =
              (1.0 - (child.userData.scaleVal - 0.5) / (child.userData.maxScale - 0.5)) * 0.7;
          }
          if (child.userData.isRotatingRing) {
            child.rotation.z += child.userData.rotSpeed;
          }
          if (child.userData.isCyberpunkBeacon) {
            const scaleY =
              1.0 + Math.sin(performance.now() * 0.008 + hash(child.position.x, child.position.y) * 10) * 0.15;
            child.scale.set(1, scaleY, 1);
          }
          if (child.userData.particles && child.userData.pPoints) {
            const particles = child.userData.particles;
            const pPoints = child.userData.pPoints;
            const posAttr = pPoints.geometry.getAttribute('position');
            for (let p = 0; p < particles.length; p++) {
              const pt = particles[p];
              pt.t += pt.speed * 0.014;
              if (pt.t > 1) pt.t = 0;
              const pos = pt.curveObj.curve.getPointAt(pt.t);
              posAttr.setXYZ(p, pos.x, pos.y, pos.z);
            }
            posAttr.needsUpdate = true;
          }
        }
      });

      controller.updateMarkerLabels(
        projectMarkerLabels(markerRoot.userData.markerGroup, camera, renderer.domElement)
      );

      const scaleBarLabel = formatScaleBar(controlsInstance.radius, camera, renderer.domElement.clientWidth);
      controller.updateHUD({
        altitude: alt,
        focusLat: lat,
        focusLng: lng,
        scaleLabel: formatAltitude(alt),
        scaleBarPx: scaleBarLabel.px,
        scaleBarLabel: scaleBarLabel.label,
      });

      renderer.render(scene, camera);
    } catch (e) {
      console.error('tick error', e);
    }
    raf = requestAnimationFrame(tick);
  }
  tick();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    unsubscribeMap();
    unsubscribeState();
    renderer.domElement.removeEventListener('click', handleCanvasClick);
    renderer.dispose();
    mount.removeChild(renderer.domElement);
    clearEnginePort(enginePortRef);
  };
}
