import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Builds straight into ../static so `python -m uvicorn app:app` serves the
// compiled app with no node runtime and no network (AGENTS.md invariant 8).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/",
  build: {
    outDir: "../static",
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8321" },
  },
});
