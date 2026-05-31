/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import * as THREE from 'three';
import type { GlobeRenderConfig, GlobeRenderModeDefinition } from '../types';
import { buildMapCanvas, buildTextureSphere } from '../engine/builders/mapCanvas';
import { buildContinentOutlines } from '../engine/builders/continentOutline';
import { buildDotCloud, buildHybridArcs, buildCyberpunkArcs, buildCyberpunkRings } from '../engine/builders/dotCloud';
import { R_OCEAN } from '../engine/constants/globeConstants';

export const SURFACE_RENDER_MODE: GlobeRenderModeDefinition = {
  name: 'Solid',
  renderFunction(config: GlobeRenderConfig) {
    const group = new THREE.Group();
    // Land/ocean fill only — the coastline is drawn as screen-width vector lines
    // so it stays crisp at every zoom instead of ballooning with the texture.
    const canvas = buildMapCanvas(config.continents, {
      oceanColor: config.map.oceanColor,
      landColor: config.map.landColor,
      drawOutline: false,
    });
    group.add(buildTextureSphere(canvas, R_OCEAN));
    group.add(buildContinentOutlines(config.continents, { color: '#0a0a14', fat: config.fatOutline }));
    return group;
  },
  getAtmosphereColor() {
    return new THREE.Color(0.45, 0.7, 1.0);
  },
  getMarkerMode() {
    return 'surface';
  },
};

export const DOTS_RENDER_MODE: GlobeRenderModeDefinition = {
  name: 'Dots',
  renderFunction(config: GlobeRenderConfig) {
    const group = new THREE.Group();
    const baseCanvas = buildMapCanvas(config.continents, {
      landColor: '#14371f',
      oceanColor: '#06142a',
      drawOutline: false,
    });
    group.add(buildTextureSphere(baseCanvas, R_OCEAN, { opacity: 0.58, transparent: true }));
    group.add(buildDotCloud(config.continents, 'dots'));
    group.add(buildContinentOutlines(config.continents, { color: '#7fd4ff', fat: config.fatOutline }));
    return group;
  },
  getAtmosphereColor() {
    return new THREE.Color(0.45, 0.7, 1.0);
  },
  getMarkerMode() {
    return 'surface';
  },
};

export const HYBRID_RENDER_MODE: GlobeRenderModeDefinition = {
  name: 'Hybrid',
  renderFunction(config: GlobeRenderConfig) {
    const group = new THREE.Group();
    const baseCanvas = buildMapCanvas(config.continents, {
      landColor: '#111a2f',
      oceanColor: '#030814',
      drawOutline: false,
    });
    group.add(buildTextureSphere(baseCanvas, R_OCEAN, {
      color: 0x7c5cff,
      opacity: 0.52,
      transparent: true,
    }));
    const dots = buildDotCloud(config.continents, 'hybrid');
    group.add(dots);
    group.add(buildHybridArcs(dots.userData.landPoints || []));
    group.add(buildContinentOutlines(config.continents, { color: '#a98cff', fat: config.fatOutline }));
    return group;
  },
  getAtmosphereColor() {
    return new THREE.Color('#7c5cff');
  },
  getMarkerMode() {
    return 'surface';
  },
};

export const CYBERPUNK_RENDER_MODE: GlobeRenderModeDefinition = {
  name: 'Cyber',
  renderFunction(config: GlobeRenderConfig) {
    const group = new THREE.Group();
    const baseCanvas = buildMapCanvas(config.continents, {
      landColor: '#0c001c',
      oceanColor: '#020008',
      drawOutline: false,
      landGrid: true,
    });
    group.add(buildTextureSphere(baseCanvas, R_OCEAN, {
      color: 0xffffff,
      opacity: 0.8,
      transparent: true,
    }));
    const dots = buildDotCloud(config.continents, 'cyberpunk');
    group.add(buildCyberpunkRings());
    group.add(dots);
    group.add(buildCyberpunkArcs(dots.userData.landPoints || []));
    group.add(buildContinentOutlines(config.continents, { color: '#00ffff', fat: config.fatOutline }));
    return group;
  },
  getAtmosphereColor() {
    return new THREE.Color('#ff00b0');
  },
  getMarkerMode() {
    return 'cyberpunk';
  },
  animate(group, _context) {
    group.traverse((child) => {
      if (child.userData?.isCyberpunkRings) {
        child.traverse((sub) => {
          if (sub.isMesh && sub.material.wireframe) {
            sub.rotation.y += 0.0015;
            sub.rotation.x += 0.0006;
          }
          if (sub.userData?.isScanner) {
            const time = performance.now() * 0.0012;
            const y = Math.sin(time) * 1.02;
            sub.position.y = y;
            const R = 1.03;
            const r = Math.sqrt(Math.max(0.01, R * R - y * y));
            sub.scale.set(r, 1, r);
          }
        });
      }
      if (child.userData?.particles && child.userData?.pPoints) {
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
    });
  },
};

export const BUILTIN_RENDER_MODES: GlobeRenderModeDefinition[] = [
  SURFACE_RENDER_MODE,
  DOTS_RENDER_MODE,
  HYBRID_RENDER_MODE,
  CYBERPUNK_RENDER_MODE,
];
