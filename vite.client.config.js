import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: path.resolve(rootDir, "apps/client"),
  publicDir: path.resolve(rootDir, "public"),
  envDir: rootDir,
  optimizeDeps: {
    include: ['leaflet', 'react-leaflet'],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(rootDir, "shared"),
    },
  },
  css: {
    postcss: path.resolve(rootDir, "postcss.config.js"),
  },
  build: {
    outDir: path.resolve(rootDir, "dist/client"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(rootDir, "apps/client/index.html"),
    },
  },
  server: {
    port: 5173,
    strictPort: false,    // Allow fallback to next port if 5173 is busy
    fs: {
      allow: [rootDir],
    },
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
});
