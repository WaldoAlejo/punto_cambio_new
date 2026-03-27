const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

const requiredFiles = [
  {
    label: "Frontend index",
    filePath: path.join(projectRoot, "dist", "index.html"),
  },
  {
    label: "Backend entry",
    filePath: path.join(projectRoot, "dist-server", "server", "index.js"),
  },
  {
    label: "PM2 config",
    filePath: path.join(projectRoot, "ecosystem.config.cjs"),
  },
];

const missing = requiredFiles.filter((item) => !fs.existsSync(item.filePath));

if (missing.length > 0) {
  console.error("❌ Build incompleto. Faltan artefactos requeridos:");
  missing.forEach((item) => {
    console.error(` - ${item.label}: ${item.filePath}`);
  });
  process.exit(1);
}

const assetsDir = path.join(projectRoot, "dist", "assets");
const assetFiles = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];
const hasJsAsset = assetFiles.some((fileName) => fileName.endsWith(".js"));
const hasCssAsset = assetFiles.some((fileName) => fileName.endsWith(".css"));

if (!hasJsAsset || !hasCssAsset) {
  console.error("❌ Build frontend incompleto. No se encontraron assets JS y CSS en dist/assets.");
  process.exit(1);
}

console.log("✅ Build verificado: frontend y backend listos para despliegue con PM2.");