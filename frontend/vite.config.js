import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Write build artifacts next to the backend runtime to avoid path issues on Railway.
    outDir: "../backend/public",
    emptyOutDir: true
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    cors: false
  }
});
