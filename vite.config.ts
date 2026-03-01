import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false,
      includeAssets: ['pwa-192x192.svg', 'pwa-512x512.svg', 'apple-touch-icon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json,woff2}'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    clearMocks: true,
  },
})





