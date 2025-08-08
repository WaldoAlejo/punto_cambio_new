import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0", // permite conexiones externas (desde cualquier IP)
    port: 8080, // puerto accesible públicamente
    proxy: {
      "/api": {
        target: "http://34.132.200.84:3001", // backend corriendo en GCP
        changeOrigin: true,
        secure: false,
      },
    },
    watch: {
      usePolling: true,
      interval: 1000,
      binaryInterval: 1000,
      useFsEvents: false,
      ignored: [
        "**/node_modules/**",
        "**/dist/**",
        "**/build/**",
        "**/.git/**",
        "**/coverage/**",
        "**/server/**",
        "**/prisma/**",
        "**/public/**",
        "**/.env*",
        "**/package-lock.json",
        "**/bun.lockb",
        "**/tsconfig*.json",
      ],
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["fsevents"],
  },
}));
