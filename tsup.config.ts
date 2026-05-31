import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  loader: {
    '.geojson': 'file',
  },
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
  // Keep Three.js external so the consumer shares a single instance with the
  // globe (so `controller.getThree()` objects, `instanceof`, and the re-exported
  // `THREE` all line up). It stays a runtime dependency, so it's still installed.
  external: ['react', 'react-dom', 'three', /^three\//],
});
