// Build for the local fixture only. Never publish this artifact: its API is localhost.
// Run from the repository root: node scripts/tests/build-frontend-check.mjs
import { build } from 'vite';

await build({
  envDir: false,
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('http://127.0.0.1:4173/api'),
  },
  build: {
    outDir: 'node_modules/.cache/frontend-check',
    emptyOutDir: false,
  },
});
