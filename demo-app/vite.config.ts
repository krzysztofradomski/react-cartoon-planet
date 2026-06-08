import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

const demoAppDir = path.dirname(fileURLToPath(import.meta.url))
const libraryRoot = path.resolve(demoAppDir, '..')

// Bundle from library source so Vite emits ?url geojson assets into dist/assets/.
// Pre-built dist/index.js only embeds hashed filenames as strings — those files
// are not copied into the demo-app output and 404 in production.
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  resolve: {
    alias: [
      { find: /^react-cartoon-planet$/, replacement: path.join(libraryRoot, 'src/index.ts') },
      { find: /^react-cartoon-planet\/style\.css$/, replacement: path.join(libraryRoot, 'src/styles/cartoon-planet.css') },
    ],
  },
  optimizeDeps: {
    include: ['three', 'earcut'],
    exclude: ['react-cartoon-planet'],
  },
})
