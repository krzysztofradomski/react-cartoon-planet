/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GlobeControls } from '../globeControls';
import { buildPlanetSurface } from '../builders/planetSurface';
import { buildStarfield } from '../builders/starfield';
import { buildTerminator, buildCityLights, buildCloudLayer } from '../builders/dayNight';
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
const _mapAtmoColor = new THREE.Color();
const _drawingBufferSize = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();

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
  bloom?: boolean | { strength?: number; radius?: number; threshold?: number } | null;
  dayNight?: boolean;
  clouds?: boolean;
  onSceneReady?: (three: any) => void;
};

export function attachGlobeScene({
  mount,
  enginePortRef,
  controller,
  startView,
  bloom,
  dayNight,
  clouds,
  onSceneReady,
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
  let prevTickRadius = -1;
  let prevTickTheta = -1;
  let prevTickPhi = -1;
  let prevTickMarkerKey = '';

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
    renderer.getDrawingBufferSize(_drawingBufferSize);
    updateContinentOutlineResolution(surfaceGroup, _drawingBufferSize.x, _drawingBufferSize.y);
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

  // Outer halo: back-side shell that reads as the glow *around* the limb.
  // Opacity must go through a uniform — ShaderMaterial ignores `.opacity`.
  const atmoGeo = new THREE.SphereGeometry(1.06, 64, 48);
  const atmoMat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color(0.45, 0.7, 1.0) },
      uOpacity: { value: 0 },
    },
    vertexShader: `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
    fragmentShader: `
        #include <common>
        #include <logdepthbuf_pars_fragment>
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec3 vNormal;
        void main() {
          #include <logdepthbuf_fragment>
          float intensity = pow(0.7 - dot(vNormal, vec3(0,0,1.0)), 2.0);
          gl_FragColor = vec4(uColor, 1.0) * intensity * uOpacity;
        }`,
  });
  const atmo = new THREE.Mesh(atmoGeo, atmoMat);
  scene.add(atmo);

  // Inner rim: fresnel glow hugging the surface so the planet edge picks up a
  // soft atmospheric scatter when seen from orbit. Fades out with the halo.
  const atmoRimGeo = new THREE.SphereGeometry(1.012, 64, 48);
  const atmoRimMat = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color(0.45, 0.7, 1.0) },
      uOpacity: { value: 0 },
    },
    vertexShader: `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
          #include <logdepthbuf_vertex>
        }`,
    fragmentShader: `
        #include <common>
        #include <logdepthbuf_pars_fragment>
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          #include <logdepthbuf_fragment>
          float fresnel = pow(1.0 - abs(dot(normalize(vView), normalize(vNormal))), 3.0);
          gl_FragColor = vec4(uColor, fresnel * uOpacity);
        }`,
  });
  const atmoRim = new THREE.Mesh(atmoRimGeo, atmoRimMat);
  scene.add(atmoRim);

  function applyMapAtmosphere() {
    const mapOpts = getMapOptions();
    const strength = mapOpts.atmosphereStrength != null ? mapOpts.atmosphereStrength : 1;
    atmoMat.uniforms.uColor.value.set(mapOpts.atmosphereColor || '#73b3ff');
    atmo.userData.strength = strength;
  }
  applyMapAtmosphere();

  // Day/night cycle: a shared sun direction drives the terminator shadow and
  // the night-side city lights; an independent cloud sphere drifts above the
  // surface. Active only when the render mode opts in via getDayNight() and
  // the map enables the matching layers.
  const sunDir = new THREE.Vector3(1, 0.3, 0.55).normalize();
  const dayNightGroup = new THREE.Group();
  dayNightGroup.userData.kind = 'day-night';
  planet.add(dayNightGroup);
  let cloudLayer = null; // cached — map-independent, expensive canvas
  let terminator = null;
  let cityLights = null;
  let dayNightKey = '';
  // Runtime toggles (props on <CartoonPlanet>); the mode's getDayNight() and
  // the map's clouds/nightLights flags still gate what each one can show.
  let dayNightEnabled = dayNight !== false;
  let cloudsEnabled = clouds !== false;

  function rebuildDayNight() {
    const modeObj = renderCatalog.get(currentRenderModeName());
    const modeSupportsDayNight = !!modeObj?.getDayNight?.();
    const dayNightOn = dayNightEnabled && modeSupportsDayNight;
    const mapOpts = getMapOptions();
    const wantClouds = cloudsEnabled && modeSupportsDayNight && !!mapOpts.clouds;
    const wantLights = dayNightOn && !!mapOpts.nightLights;
    const continents = mapCatalog.getContinents();
    const nextKey = `${dayNightOn}:${wantClouds}:${wantLights}:${mapCatalog.getActiveName()}:${continents.length}`;
    if (nextKey === dayNightKey) return;
    dayNightKey = nextKey;

    if (terminator) {
      dayNightGroup.remove(terminator);
      disposeObject3D(terminator);
      terminator = null;
    }
    if (cityLights) {
      dayNightGroup.remove(cityLights);
      disposeObject3D(cityLights);
      cityLights = null;
    }
    if (cloudLayer) cloudLayer.visible = wantClouds;

    if (dayNightOn) {
      terminator = buildTerminator(sunDir);
      dayNightGroup.add(terminator);
    }
    if (wantLights) {
      cityLights = buildCityLights(continents, renderer.getPixelRatio());
      cityLights.material.uniforms.uSunDir.value = sunDir;
      dayNightGroup.add(cityLights);
    }
    if (wantClouds && !cloudLayer) {
      cloudLayer = buildCloudLayer();
      dayNightGroup.add(cloudLayer);
    }
  }
  rebuildDayNight();

  if (loadMap) {
    loadMap()
      .then(() => {
        rebuildContinents();
        applyMapAtmosphere();
        rebuildDayNight();
      })
      .catch((err) => console.warn('Planet map data fetch failed; using fallback.', err));
  }

  function onPlanetMapChanged() {
    rebuildContinents();
    applyMapAtmosphere();
    rebuildDayNight();
  }
  const unsubscribeMap = mapCatalog.onChange(onPlanetMapChanged);

  const stars = buildStarfield();
  stars.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  scene.add(stars);

  const controlsInstance = new GlobeControls(camera, renderer.domElement);
  controls = controlsInstance;
  const initialView = START_VIEWS[startView] || START_VIEWS.globe;
  controlsInstance.jumpTo(initialView.lng, initialView.lat, 1 + initialView.alt_m / EARTH_RADIUS_M);

  // Optional bloom post-processing, toggleable at runtime via the engine port.
  // The OutputPass keeps the composer path color-identical (sRGB) to the
  // direct renderer.render() path.
  let composer = null;
  let bloomPass = null;
  function applyBloom(next) {
    if (!next) {
      bloomPass?.dispose?.();
      composer?.dispose?.();
      composer = null;
      bloomPass = null;
      return;
    }
    const opts = typeof next === 'object' ? next : {};
    const strength = opts.strength ?? 0.55;
    const radius = opts.radius ?? 0.5;
    const threshold = opts.threshold ?? 0.12;
    if (composer && bloomPass) {
      bloomPass.strength = strength;
      bloomPass.radius = radius;
      bloomPass.threshold = threshold;
      return;
    }
    const cw = mount.clientWidth || w;
    const ch = mount.clientHeight || h;
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(cw, ch);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(cw, ch), strength, radius, threshold);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  }
  applyBloom(bloom);

  // Live Three.js handles for consumers (controller.getThree() / onSceneReady).
  const three = {
    scene,
    camera,
    renderer,
    controls: controlsInstance,
    planet,
    surfaceGroup,
    markerRoot,
    getMarkerGroup: () => markerRoot.userData.markerGroup ?? null,
  };

  bindEnginePort(enginePortRef, {
    controls: controlsInstance,
    three,
    setRenderMode: (mode) => {
      rebuildSurface(surfaceGroup.userData.outlinePx || 12, mode);
      rebuildDayNight();
    },
    rebuildPlanetMap: () => {
      rebuildContinents();
      applyMapAtmosphere();
      rebuildDayNight();
    },
    setMarkers: (nextMarkers) => {
      const list = Array.isArray(nextMarkers) ? nextMarkers : [];
      const { altM, mpp } = getViewMetrics();
      rebuildMarkers(list, surfaceGroup.userData.mode, altM, mpp);
    },
    setBloom: applyBloom,
    setDayNight: (enabled) => {
      dayNightEnabled = enabled !== false;
      rebuildDayNight();
    },
    setClouds: (enabled) => {
      cloudsEnabled = enabled !== false;
      rebuildDayNight();
    },
  });

  onSceneReady?.(three);

  function handleMarkerPick(marker) {
    if (!marker) return;
    // App-level hook runs first; returning false suppresses the default fly-to.
    const onMarkerClick = enginePortRef.current?.onMarkerClick;
    if (onMarkerClick && onMarkerClick(marker) === false) return;
    if (marker.isCluster) {
      controller.flyTo(marker.lng, marker.lat, marker.frameAltitudeM ?? 450);
      return;
    }
    controller.flyToMarker(marker.id);
  }

  let hoveredMarkerId = null;
  let lastHoverCheck = 0;
  function handlePointerMove(e) {
    const now = performance.now();
    if (now - lastHoverCheck < 33) return;
    lastHoverCheck = now;
    if (enginePortRef.current?.isPlacingMode) return;
    const markerGroup = markerRoot.userData.markerGroup;
    if (!markerGroup) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    _raycaster.setFromCamera(mouse, camera);

    let hovered = null;
    const hits = _raycaster.intersectObjects(markerGroup.children, true);
    for (const hit of hits) {
      const marker = findMarkerFromObject(hit.object);
      if (marker) {
        hovered = marker;
        break;
      }
    }

    const hoveredId = hovered ? hovered.id ?? hovered.label : null;
    for (const item of markerGroup.userData.items || []) {
      item.userData.hoverTarget = hoveredId != null && item.userData.marker === hovered ? 1 : 0;
    }
    renderer.domElement.style.cursor = hovered ? 'pointer' : '';

    if (hoveredId !== hoveredMarkerId) {
      hoveredMarkerId = hoveredId;
      enginePortRef.current?.onMarkerHover?.(hovered);
    }
  }
  renderer.domElement.addEventListener('pointermove', handlePointerMove);

  function handleCanvasClick(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    _raycaster.setFromCamera(mouse, camera);

    if (!enginePortRef.current?.isPlacingMode) {
      const markerGroup = markerRoot.userData.markerGroup;
      if (markerGroup) {
        const markerHits = _raycaster.intersectObjects(markerGroup.children, true);
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
    if (_raycaster.ray.intersectSphere(_placeSphere, _placeHit)) {
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
    if (!rw || !rh) return;
    renderer.setSize(rw, rh);
    composer?.setSize(rw, rh);
    camera.aspect = rw / rh;
    camera.updateProjectionMatrix();
    syncOutlineResolution();
  }
  window.addEventListener('resize', onResize);
  // The mount can resize without a window resize (surrounding layout/panel
  // changes); observe it directly so the canvas never renders stretched.
  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
  resizeObserver?.observe(mount);

  const unsubscribeState = controller.subscribe((state) => {
    if (
      state.renderMode !== surfaceGroup.userData.mode ||
      !!state.fatOutlines !== !!surfaceGroup.userData.fatOutlines
    ) {
      rebuildSurface(surfaceGroup.userData.outlinePx || 12, state.renderMode);
      rebuildDayNight();
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
      const { lat, lng } = vec3ToLngLat(dir);

      const atmoStrength = atmo.userData.strength != null ? atmo.userData.strength : 1;
      const atmoOpacity = THREE.MathUtils.clamp((alt / 1_000_000) * atmoStrength, 0, 1);
      atmoMat.uniforms.uOpacity.value = atmoOpacity;
      atmoRimMat.uniforms.uOpacity.value = atmoOpacity * 0.85;
      stars.material.uniforms.uOpacity.value = THREE.MathUtils.clamp(alt / 8_000_000, 0, 1);
      stars.material.uniforms.uTime.value = performance.now() * 0.001;

      const currentMode = surfaceGroup.userData.mode;
      const modeObj = renderCatalog.get(currentMode);
      const modeAtmo = modeObj?.getAtmosphereColor
        ? modeObj.getAtmosphereColor()
        : new THREE.Color(0.45, 0.7, 1.0);
      _mapAtmoColor.set(getMapOptions().atmosphereColor || '#73b3ff');
      atmoMat.uniforms.uColor.value.copy(modeAtmo).lerp(_mapAtmoColor, 0.35);
      atmoRimMat.uniforms.uColor.value.copy(atmoMat.uniforms.uColor.value);

      // Day/night: precess the sun slowly (full cycle ≈ 3.5 min) so the
      // terminator and city lights drift across the globe. Layers fade out on
      // approach to ground level so they never obstruct the close-up view.
      const sunAngle = performance.now() * 0.00003;
      sunDir.set(Math.cos(sunAngle), 0.3, Math.sin(sunAngle)).normalize();
      if (terminator) {
        terminator.material.uniforms.uOpacity.value =
          THREE.MathUtils.clamp(alt / 900_000, 0, 1) * 0.78;
      }
      if (cityLights) {
        cityLights.material.uniforms.uOpacity.value = THREE.MathUtils.clamp(alt / 400_000, 0, 1);
      }
      if (cloudLayer && cloudLayer.visible) {
        cloudLayer.rotation.y += 0.00016;
        cloudLayer.material.opacity = THREE.MathUtils.clamp((alt - 60_000) / 700_000, 0, 0.85);
      }

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

      // Only push React state updates when the camera has actually moved or the
      // marker set has changed. At 60 fps on a static globe this drops ~120
      // store.notify() calls/sec (two per frame) to zero, preventing continuous
      // React re-renders of the entire UI subtree.
      const cameraOrMarkerChanged =
        controlsInstance.radius !== prevTickRadius ||
        controlsInstance.theta !== prevTickTheta ||
        controlsInstance.phi !== prevTickPhi ||
        lastMarkerDisplayKey !== prevTickMarkerKey;

      if (cameraOrMarkerChanged) {
        prevTickRadius = controlsInstance.radius;
        prevTickTheta = controlsInstance.theta;
        prevTickPhi = controlsInstance.phi;
        prevTickMarkerKey = lastMarkerDisplayKey;

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
      }

      if (composer) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    } catch (e) {
      console.error('tick error', e);
    }
    raf = requestAnimationFrame(tick);
  }
  tick();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    resizeObserver?.disconnect();
    unsubscribeMap();
    unsubscribeState();
    renderer.domElement.removeEventListener('click', handleCanvasClick);
    renderer.domElement.removeEventListener('pointermove', handlePointerMove);
    applyBloom(null);
    renderer.dispose();
    mount.removeChild(renderer.domElement);
    clearEnginePort(enginePortRef);
  };
}
