import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Conditional import for lovable-tagger (only available in Lovable environment)
function getComponentTagger() {
  try {
    // Try to require lovable-tagger - will fail gracefully in local environment
    // @ts-ignore - require may not be typed in ESM, but it's wrapped in try/catch
    const { componentTagger } = require("lovable-tagger");
    return componentTagger;
  } catch {
    // lovable-tagger not available in local environment
    return null;
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const componentTagger = getComponentTagger();

  return {
    base: mode === "production" ? "./" : "/",
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
      emptyOutDir: true,
      sourcemap: mode !== "production",
      chunkSizeWarningLimit: 1000, // ← sube el límite del warning
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
      react(), // ← sin jsxRuntime
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
    // esbuild no es necesario para JSX cuando usas el plugin SWC
  };
});
