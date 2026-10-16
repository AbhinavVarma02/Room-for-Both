import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export const aliases = {
  "@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
  "@client": fileURLToPath(new URL("./src/client", import.meta.url)),
  "@worker": fileURLToPath(new URL("./src/worker", import.meta.url)),
};

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  resolve: { alias: aliases },
  build: {
    // We never ship source maps publicly; they would expose server modules bundled for the Worker.
    sourcemap: false,
    chunkSizeWarningLimit: 600,
  },
});
