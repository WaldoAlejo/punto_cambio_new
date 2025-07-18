import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": "http://localhost:3001", // 👈👈 AQUÍ EL PROXY
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
  plugins: [react(), mode === "development" && componentTagger()].filter(
    Boolean
  ),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["fsevents"],
  },
}));
