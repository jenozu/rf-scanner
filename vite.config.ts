import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    host: true, // bind to 0.0.0.0 so LAN devices can reach it
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})

