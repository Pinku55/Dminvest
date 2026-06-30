import { defineConfig } from "vite";

// Pure static SPA build — no Node.js server/runtime involved.
// `base: "./"` keeps asset paths relative so dist/ can be hosted anywhere.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    target: "es2020",
    sourcemap: false,
  },
  server: {
    port: 5173,
    open: true,
  },
});
