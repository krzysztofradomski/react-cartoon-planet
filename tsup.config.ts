import { defineConfig } from 'tsup';

export default defineConfig([
  {
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
    external: ['react', 'react-dom', 'three', /^three\//],
  },
  {
    entry: ['src/native/index.ts'],
    outDir: 'dist/native',
    format: ['esm'],
    dts: true,
    sourcemap: true,
    loader: {
      '.geojson': 'file',
    },
    esbuildOptions(options) {
      options.jsx = 'automatic';
    },
    external: [
      'react',
      'react-native',
      'expo-gl',
      'three',
      /^three\//,
    ],
  },
]);
