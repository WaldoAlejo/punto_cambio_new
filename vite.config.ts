import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Conditional import for lovable-tagger (only available in Lovable environment)
function getComponentTagger() {
  try {
    // @ts-ignore - require may not be typed in ESM, but it's wrapped in try/catch
    const { componentTagger } = require("lovable-tagger");
    return componentTagger;
  } catch {
    return null;
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const componentTagger = getComponentTagger();

  return {
    // IMPORTANTE: usar "/" también en producción para que los assets vivan en /assets
    base: "/",

    server: {
      host: "0.0.0.0",
      port: 8080,
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
      assetsDir: "assets", // explícito (default), asegura /assets/...
      emptyOutDir: true,
      sourcemap: mode !== "production",
      chunkSizeWarningLimit: 5000,
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
      react(),
      mode === "development" && componentTagger && componentTagger(),
    ].filter(Boolean),

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    optimizeDeps: {
      exclude: ["fsevents"],
    },
  };
});
