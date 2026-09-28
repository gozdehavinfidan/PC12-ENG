import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Dev: Vite serves the UI and proxies /api to the local FastAPI server.
// Build: a fully self-contained static bundle in app/static (served by FastAPI;
// no CDN, fonts and workers included) — CLAUDE.md s7 offline rule.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:8765', changeOrigin: false } },
  },
  build: {
    outDir: '../static',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1600,
    assetsInlineLimit: 0,
  },
  worker: { format: 'es' },
})
