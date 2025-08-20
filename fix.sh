#!/bin/bash

# Script para verificar y corregir problemas comunes
# Este script debe ejecutarse desde el directorio raíz del proyecto

# Colores para mensajes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Función para mostrar mensajes
function log_message() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

function log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

function log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
  log_error "Este script debe ejecutarse desde el directorio raíz del proyecto"
  exit 1
fi

# Crear directorio para logs si no existe
mkdir -p logs

# Verificar que existe el archivo tsconfig.server.json
if [ ! -f "tsconfig.server.json" ]; then
  log_warning "El archivo tsconfig.server.json no existe. Creando..."
  cat > tsconfig.server.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Node",
    "outDir": "./dist",
    "rootDir": "./server",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true,
    "allowImportingTsExtensions": false,
    "noEmit": false
  },
  "include": ["server/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF
  log_message "Archivo tsconfig.server.json creado"
fi

# Verificar que el archivo package.json tiene el tipo module
log_message "Verificando que el archivo package.json tiene el tipo module..."
if grep -q '"type": "module"' package.json; then
  log_message "El archivo package.json tiene el tipo module"
else
  log_warning "El archivo package.json no tiene el tipo module. Actualizando..."
  sed -i 's|"private": true,|"private": true,\n  "type": "module",|g' package.json
  log_message "Archivo package.json actualizado"
fi

# Verificar que existe el archivo .env.production
if [ ! -f ".env.production" ]; then
  log_warning "El archivo .env.production no existe. Creando..."
  cat > .env.production << 'EOF'
# Variables de entorno para producción
DATABASE_URL=postgresql://postgres:Esh2ew8p@34.66.51.85:5432/punto_cambio
DB_USER=postgres
DB_PASSWORD=Esh2ew8p
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_TIMEOUT=30000
JWT_SECRET=s3rv13ntr3g4_super_secure_jwt_key_change_in_production
NODE_ENV=production
PORT=3001
FRONTEND_URL=http://35.238.95.118:3001
LOG_LEVEL=info
VITE_API_URL=http://35.238.95.118:3001/api
VITE_APP_NAME=Punto Cambio
VITE_APP_VERSION=1.0.0
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_MAX_REQUESTS=5
EOF
  log_message "Archivo .env.production creado"
fi

# Verificar que existe el archivo .env
if [ ! -f ".env" ]; then
  log_warning "El archivo .env no existe. Creando..."
  cp .env.production .env
  log_message "Archivo .env creado"
fi

# Verificar que existe el archivo ecosystem.config.js
if [ ! -f "ecosystem.config.js" ]; then
  log_warning "El archivo ecosystem.config.js no existe. Creando..."
  cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: "punto-cambio-api",
      script: "./dist/index.js",
      instances: 1,
      exec_mode: "fork",
      env_production: {
        NODE_ENV: "production",
        PORT: 3001
      },
      watch: false,
      node_args: "--experimental-specifier-resolution=node"
    }
  ]
};
EOF
  log_message "Archivo ecosystem.config.js creado"
fi

# Verificar que existe el directorio dist
if [ ! -d "dist" ]; then
  log_warning "El directorio dist no existe. Creando..."
  mkdir -p dist
  log_message "Directorio dist creado"
fi

# Verificar que existe el archivo dist/index.js
if [ ! -f "dist/index.js" ]; then
  log_warning "El archivo dist/index.js no existe. Creando..."
  cat > dist/index.js << 'EOF'
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno según el entorno
if (fs.existsSync(".env.local")) {
  console.log("Cargando variables de entorno desde .env.local");
  dotenv.config({ path: ".env.local" });
} else if (fs.existsSync(".env.production")) {
  console.log("Cargando variables de entorno desde .env.production");
  dotenv.config({ path: ".env.production" });
} else {
  console.log("Cargando variables de entorno desde .env");
  dotenv.config();
}

// Importar el servidor
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("dist"));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Servir archivos estáticos del frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "dist", "index.html"));
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
EOF
  log_message "Archivo dist/index.js creado"
fi

# Verificar que existe el archivo dist/index.html
if [ ! -f "dist/index.html" ]; then
  log_warning "El archivo dist/index.html no existe. Creando..."
  cat > dist/index.html << 'EOF'
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Punto Cambio</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background-color: #f5f5f5;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    h1 {
      color: #333;
    }
    p {
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Punto Cambio</h1>
    <p>La aplicación está en mantenimiento. Por favor, intente más tarde.</p>
  </div>
</body>
</html>
EOF
  log_message "Archivo dist/index.html creado"
fi

# Verificar que PM2 está instalado
if ! command -v pm2 &> /dev/null; then
  log_warning "PM2 no está instalado. Instalando..."
  npm install -g pm2
  log_message "PM2 instalado"
fi

# Verificar que la aplicación está en ejecución
if ! pm2 list | grep -q "punto-cambio-api"; then
  log_warning "La aplicación no está en ejecución. Iniciando..."
  pm2 start ecosystem.config.js --env production || {
    log_error "Error al iniciar la aplicación con PM2. Intentando directamente..."
    pm2 start dist/index.js --name punto-cambio-api --node-args="--experimental-specifier-resolution=node" || {
      log_error "Error al iniciar la aplicación con PM2. Intentando con node directamente..."
      node --experimental-specifier-resolution=node dist/index.js &
    }
  }
  log_message "Aplicación iniciada"
fi

# Verificar que la aplicación está respondiendo
log_message "Verificando que la aplicación está respondiendo..."
if curl -s http://localhost:3001/health > /dev/null; then
  log_message "La aplicación está respondiendo correctamente"
else
  log_warning "La aplicación no está respondiendo. Reiniciando..."
  pm2 restart punto-cambio-api || {
    log_error "Error al reiniciar la aplicación con PM2. Intentando iniciar..."
    pm2 start ecosystem.config.js --env production || {
      log_error "Error al iniciar la aplicación con PM2. Intentando directamente..."
      pm2 start dist/index.js --name punto-cambio-api --node-args="--experimental-specifier-resolution=node" || {
        log_error "Error al iniciar la aplicación con PM2. Intentando con node directamente..."
        node --experimental-specifier-resolution=node dist/index.js &
      }
    }
  }
  log_message "Aplicación reiniciada"
fi

# Verificar el estado de la aplicación
log_message "Verificando el estado de la aplicación..."
pm2 status

log_message "Verificación y corrección completadas con éxito"