// ecosystem.config.cjs
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

// Load .env.production for PM2
let envVars = { NODE_ENV: "production", PORT: 3001 };

const prodEnvPath = path.join(__dirname, ".env.production");
if (fs.existsSync(prodEnvPath)) {
  const envConfig = dotenv.config({ path: prodEnvPath });
  if (envConfig.parsed) {
    envVars = { ...envVars, ...envConfig.parsed };
    console.log("✅ .env.production loaded for PM2");
  }
}

module.exports = {
  apps: [
    {
      name: "punto-cambio-api",
      cwd: path.join(__dirname),
      script: "dist-server/server/index.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      time: true,
      node_args: "--enable-source-maps",
      env: envVars,
    },
  ],
};
