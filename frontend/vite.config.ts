import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
