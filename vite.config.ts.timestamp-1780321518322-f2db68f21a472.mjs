// vite.config.ts
import { defineConfig } from "file:///C:/Users/gabri/OneDrive/Documentos/meusapps/minhas_financas/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/gabri/OneDrive/Documentos/meusapps/minhas_financas/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
import { VitePWA } from "file:///C:/Users/gabri/OneDrive/Documentos/meusapps/minhas_financas/node_modules/vite-plugin-pwa/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\gabri\\OneDrive\\Documentos\\meusapps\\minhas_financas";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: false,
      includeAssets: ["pwa-192x192.svg", "pwa-512x512.svg", "apple-touch-icon.svg"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,json,woff2}"],
        cleanupOutdatedCaches: true,
        navigateFallbackAllowlist: [/^\/[^.]*$/],
        runtimeCaching: []
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          charts: ["recharts"]
        }
      }
    }
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    clearMocks: true
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxnYWJyaVxcXFxPbmVEcml2ZVxcXFxEb2N1bWVudG9zXFxcXG1ldXNhcHBzXFxcXG1pbmhhc19maW5hbmNhc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcZ2FicmlcXFxcT25lRHJpdmVcXFxcRG9jdW1lbnRvc1xcXFxtZXVzYXBwc1xcXFxtaW5oYXNfZmluYW5jYXNcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL2dhYnJpL09uZURyaXZlL0RvY3VtZW50b3MvbWV1c2FwcHMvbWluaGFzX2ZpbmFuY2FzL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xyXG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSAndml0ZS1wbHVnaW4tcHdhJ1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBwbHVnaW5zOiBbXHJcbiAgICByZWFjdCgpLFxyXG4gICAgVml0ZVBXQSh7XHJcbiAgICAgIHJlZ2lzdGVyVHlwZTogJ2F1dG9VcGRhdGUnLFxyXG4gICAgICBpbmplY3RSZWdpc3RlcjogJ2F1dG8nLFxyXG4gICAgICBtYW5pZmVzdDogZmFsc2UsXHJcbiAgICAgIGluY2x1ZGVBc3NldHM6IFsncHdhLTE5MngxOTIuc3ZnJywgJ3B3YS01MTJ4NTEyLnN2ZycsICdhcHBsZS10b3VjaC1pY29uLnN2ZyddLFxyXG4gICAgICB3b3JrYm94OiB7XHJcbiAgICAgICAgZ2xvYlBhdHRlcm5zOiBbJyoqLyoue2pzLGNzcyxodG1sLHN2ZyxwbmcsanNvbix3b2ZmMn0nXSxcclxuICAgICAgICBjbGVhbnVwT3V0ZGF0ZWRDYWNoZXM6IHRydWUsXHJcbiAgICAgICAgbmF2aWdhdGVGYWxsYmFja0FsbG93bGlzdDogWy9eXFwvW14uXSokL10sXHJcbiAgICAgICAgcnVudGltZUNhY2hpbmc6IFtdLFxyXG4gICAgICB9LFxyXG4gICAgICBkZXZPcHRpb25zOiB7XHJcbiAgICAgICAgZW5hYmxlZDogZmFsc2UsXHJcbiAgICAgIH0sXHJcbiAgICB9KSxcclxuICBdLFxyXG4gIHJlc29sdmU6IHtcclxuICAgIGFsaWFzOiB7XHJcbiAgICAgICdAJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjJyksXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgYnVpbGQ6IHtcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XHJcbiAgICAgICAgICByZWFjdDogWydyZWFjdCcsICdyZWFjdC1kb20nLCAncmVhY3Qtcm91dGVyLWRvbSddLFxyXG4gICAgICAgICAgc3VwYWJhc2U6IFsnQHN1cGFiYXNlL3N1cGFiYXNlLWpzJ10sXHJcbiAgICAgICAgICBjaGFydHM6IFsncmVjaGFydHMnXSxcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9LFxyXG4gIHRlc3Q6IHtcclxuICAgIGdsb2JhbHM6IHRydWUsXHJcbiAgICBlbnZpcm9ubWVudDogJ25vZGUnLFxyXG4gICAgaW5jbHVkZTogWydzcmMvKiovKi50ZXN0LnRzJ10sXHJcbiAgICBjbGVhck1vY2tzOiB0cnVlLFxyXG4gIH0sXHJcbn0pXHJcblxyXG5cclxuXHJcblxyXG5cclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFpWCxTQUFTLG9CQUFvQjtBQUM5WSxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsZUFBZTtBQUh4QixJQUFNLG1DQUFtQztBQUt6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixRQUFRO0FBQUEsTUFDTixjQUFjO0FBQUEsTUFDZCxnQkFBZ0I7QUFBQSxNQUNoQixVQUFVO0FBQUEsTUFDVixlQUFlLENBQUMsbUJBQW1CLG1CQUFtQixzQkFBc0I7QUFBQSxNQUM1RSxTQUFTO0FBQUEsUUFDUCxjQUFjLENBQUMsdUNBQXVDO0FBQUEsUUFDdEQsdUJBQXVCO0FBQUEsUUFDdkIsMkJBQTJCLENBQUMsV0FBVztBQUFBLFFBQ3ZDLGdCQUFnQixDQUFDO0FBQUEsTUFDbkI7QUFBQSxNQUNBLFlBQVk7QUFBQSxRQUNWLFNBQVM7QUFBQSxNQUNYO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLElBQ3RDO0FBQUEsRUFDRjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sY0FBYztBQUFBLFVBQ1osT0FBTyxDQUFDLFNBQVMsYUFBYSxrQkFBa0I7QUFBQSxVQUNoRCxVQUFVLENBQUMsdUJBQXVCO0FBQUEsVUFDbEMsUUFBUSxDQUFDLFVBQVU7QUFBQSxRQUNyQjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsTUFBTTtBQUFBLElBQ0osU0FBUztBQUFBLElBQ1QsYUFBYTtBQUFBLElBQ2IsU0FBUyxDQUFDLGtCQUFrQjtBQUFBLElBQzVCLFlBQVk7QUFBQSxFQUNkO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
