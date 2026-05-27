/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import * as THREE from 'three';
import { planetRenderRegistry as PlanetRenderRegistry } from '../planetRenderRegistry';
import { buildMapCanvas, buildTextureSphere } from '../builders/mapCanvas';
import { buildDotCloud, buildHybridArcs, buildCyberpunkArcs, buildCyberpunkRings } from '../builders/dotCloud';
import { R_OCEAN } from '../constants/globeConstants';

PlanetRenderRegistry.register({
  id: 'surface',
  label: 'Solid',
  build(continents, options = {}) {
    const group = new THREE.Group();
    const outlinePx = options.outlinePx || 12;
    const canvas = buildMapCanvas(continents, {
      outlinePx,
      oceanColor: options.oceanColor,
      landColor: options.landColor,
    });
    group.add(buildTextureSphere(canvas, R_OCEAN));
    return group;
  },
  getAtmosphereColor() {
    return new THREE.Color(0.45, 0.7, 1.0);
  },
  getMarkerMode() {
    return 'surface';
  }
});

// 2. Dotted Mode (simple dotted grid)
PlanetRenderRegistry.register({
  id: 'dots',
  label: 'Dots',
  build(continents, options = {}) {
    const group = new THREE.Group();
    const baseCanvas = buildMapCanvas(continents, {
      landColor: '#14371f',
      oceanColor: '#06142a',
      drawOutline: false,
    });
    group.add(buildTextureSphere(baseCanvas, R_OCEAN, { opacity: 0.58, transparent: true }));
    group.add(buildDotCloud(continents, 'dots'));
    return group;
  },
  getAtmosphereColor() {
    return new THREE.Color(0.45, 0.7, 1.0);
  },
  getMarkerMode() {
    return 'surface';
  }
});

// 3. Hybrid Mode (dotted grid with dynamic networking connections)
PlanetRenderRegistry.register({
  id: 'hybrid',
  label: 'Hybrid',
  build(continents, options = {}) {
    const group = new THREE.Group();
    const baseCanvas = buildMapCanvas(continents, {
      landColor: '#111a2f',
      oceanColor: '#030814',
      drawOutline: false,
    });
    group.add(buildTextureSphere(baseCanvas, R_OCEAN, {
      color: 0x7c5cff,
      opacity: 0.52,
      transparent: true,
    }));
    const dots = buildDotCloud(continents, 'hybrid');
    group.add(dots);
    group.add(buildHybridArcs(dots.userData.landPoints || []));
    return group;
  },
  getAtmosphereColor() {
    return new THREE.Color('#7c5cff');
  },
  getMarkerMode() {
    return 'surface';
  }
});

// 4. Cyberpunk Mode (outstanding high-tech holographic simulation)
PlanetRenderRegistry.register({
  id: 'cyberpunk',
  label: 'Cyber',
  build(continents, options = {}) {
    const group = new THREE.Group();
    const baseCanvas = buildMapCanvas(continents, {
      landColor: '#0c001c',
      oceanColor: '#020008',
      drawOutline: true,
      outlineColor: '#00ffff',
      outlinePx: 12,
      landGrid: true,
    });
    group.add(buildTextureSphere(baseCanvas, R_OCEAN, {
      color: 0xffffff,
      opacity: 0.8,
      transparent: true,
    }));
    const dots = buildDotCloud(continents, 'cyberpunk');
    group.add(buildCyberpunkRings());
    group.add(dots);
    group.add(buildCyberpunkArcs(dots.userData.landPoints || []));
    return group;
  },
  getAtmosphereColor() {
    return new THREE.Color('#ff00b0');
  },
  getMarkerMode() {
    return 'cyberpunk';
  },
  animate(group, context) {
    // Rotate wireframe sphere and scan laser
    group.traverse(child => {
      if (child.userData && child.userData.isCyberpunkRings) {
        child.traverse(sub => {
          if (sub.isMesh && sub.material.wireframe) {
            sub.rotation.y += 0.0015;
            sub.rotation.x += 0.0006;
          }
          if (sub.userData && sub.userData.isScanner) {
            const time = performance.now() * 0.0012;
            const y = Math.sin(time) * 1.02;
            sub.position.y = y;
            const R = 1.03;
            const r = Math.sqrt(Math.max(0.01, R * R - y * y));
            sub.scale.set(r, 1, r);
          }
        });
      }
      
      // Animate flying data packets along network arcs
      if (child.userData && child.userData.particles && child.userData.pPoints) {
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
  }
});

export function registerAllRenderModes() {
  // modes self-register on import
}
