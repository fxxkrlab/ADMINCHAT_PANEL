import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// Read version files - try current dir first (Docker), then parent (local dev)
const readVersion = (file: string) => {
  for (const dir of [__dirname, path.resolve(__dirname, '..')]) {
    try {
      return fs.readFileSync(path.resolve(dir, file), 'utf-8').trim()
    } catch { /* continue */ }
  }
  return 'dev'
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(readVersion('VERSION')),
    __BUILD_VERSION__: JSON.stringify(readVersion('BUILD_VERSION')),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
  build: {
    // Enable tree shaking
    target: 'es2020',
    // Manual chunk splitting for optimal caching
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            // Core React runtime - rarely changes, high cache hit
            if (id.includes('react-dom') || id.includes('react-router') || (id.includes('/react/') && !id.includes('react-'))) {
              return 'vendor-react'
            }
            // State management & data fetching
            if (id.includes('zustand') || id.includes('@tanstack/react-query') || id.includes('axios')) {
              return 'vendor-state'
            }
            // UI libraries
            if (id.includes('lucide-react') || id.includes('react-markdown')) {
              return 'vendor-ui'
            }
            // Virtual scrolling
            if (id.includes('@tanstack/react-virtual')) {
              return 'vendor-virtual'
            }
          }
        },
      },
    },
    // Chunk size warning threshold
    chunkSizeWarningLimit: 500,
  },
})
