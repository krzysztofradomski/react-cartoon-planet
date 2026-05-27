import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  optimizeDeps: {
    include: ['three', 'earcut'],
    // Keep import.meta.url asset resolution relative to dist/index.js
    exclude: ['react-cartoon-planet'],
  },
})
