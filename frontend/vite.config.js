import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const devApiTarget = globalThis?.process?.env?.VITE_DEV_API_TARGET || 'http://localhost:7860'
const devServerPort = Number.parseInt(globalThis?.process?.env?.VITE_DEV_PORT || '5174', 10)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number.isFinite(devServerPort) ? devServerPort : 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: devApiTarget,
        changeOrigin: true,
        secure: false,
      },
      '/tutorial-videos': {
        target: devApiTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
