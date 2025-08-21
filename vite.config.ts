import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "./" : "/",
  server: {
    host: "0.0.0.0", // permite conexiones externas (desde cualquier IP)
    port: 8080, // puerto accesible públicamente

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
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: mode === "development",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          router: ["react-router-dom"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu"],
        },
      },
    },
  },
  plugins: [
    react({
      jsxRuntime: "automatic",
    }),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["fsevents"],
  },
  esbuild: {
    jsx: "automatic",
  },
}));
