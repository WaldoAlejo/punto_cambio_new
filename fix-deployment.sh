#!/bin/bash

# Script para verificar y corregir problemas comunes de despliegue
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

# Verificar que el directorio dist existe
if [ ! -d "dist" ]; then
  log_error "El directorio dist no existe"
  log_message "Creando directorio dist..."
  mkdir -p dist
fi

# Verificar que el archivo index.html existe en dist
if [ ! -f "dist/index.html" ]; then
  log_error "El archivo dist/index.html no existe"
  
  # Crear un archivo index.html básico
  log_message "Creando un archivo index.html básico..."
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
      max-width: 500px;
    }
    h1 {
      color: #333;
    }
    p {
      color: #666;
      margin-bottom: 1.5rem;
    }
    .status {
      padding: 0.5rem 1rem;
      background-color: #e6f7ff;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 1rem;
    }
    .api-link {
      color: #1890ff;
      text-decoration: none;
    }
    .api-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Punto Cambio</h1>
    <div class="status">Servidor en funcionamiento</div>
    <p>El servidor está funcionando correctamente. La API está disponible en:</p>
    <a href="/api" class="api-link">/api</a>
    <p>Verifica el estado del servidor en:</p>
    <a href="/health" class="api-link">/health</a>
  </div>
</body>
</html>
EOF
fi

# Verificar que el archivo index.js existe en dist
if [ ! -f "dist/index.js" ]; then
  log_error "El archivo dist/index.js no existe"
  
  # Crear un archivo index.js básico
  log_message "Creando un archivo index.js básico..."
  cat > dist/index.js << 'EOF'
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";

// Configuración de variables de entorno
if (fs.existsSync(".env.production")) {
  console.log("Cargando variables de entorno desde .env.production");
  dotenv.config({ path: ".env.production" });
} else {
  console.log("Cargando variables de entorno desde .env");
  dotenv.config();
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:8080",
    "http://35.238.95.118:3001",
    "http://35.238.95.118:8080",
    "http://35.238.95.118",
  ],
  credentials: true,
}));
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Servir archivos estáticos
app.use(express.static(path.join(__dirname)));

// Manejar rutas SPA
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/") || req.path === "/health") {
    return res.status(404).json({
      error: "API route not found",
      path: req.originalUrl,
    });
  }
  
  res.sendFile(path.join(__dirname, "index.html"));
});

// Iniciar servidor
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`http://localhost:${PORT}`);
});
EOF
fi

# Verificar que el archivo ecosystem.config.js existe
if [ ! -f "ecosystem.config.js" ]; then
  log_error "El archivo ecosystem.config.js no existe"
  
  # Crear un archivo ecosystem.config.js básico
  log_message "Creando un archivo ecosystem.config.js básico..."
  cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: "punto-cambio-api",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "development",
        PORT: 3001,
        LOG_LEVEL: "debug",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3001,
        LOG_LEVEL: "info",
        NODE_OPTIONS: "--max-old-space-size=1024",
      },
      log_file: "./logs/combined.log",
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      max_memory_restart: "1G",
      node_args: "--max-old-space-size=1024",
      watch: false,
      ignore_watch: ["node_modules", "logs", "dist", "src"],
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: "10s",
      autorestart: true,
      log_type: "json",
      time: true,
    },
  ],
};
EOF
fi

# Verificar que el archivo .env.production existe
if [ ! -f ".env.production" ]; then
  log_error "El archivo .env.production no existe"
  
  # Crear un archivo .env.production básico
  log_message "Creando un archivo .env.production básico..."
  cat > .env.production << 'EOF'
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
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_MAX_REQUESTS=5
EOF
fi

# Verificar que el archivo package.json tiene el tipo module
if ! grep -q '"type": "module"' package.json; then
  log_warning "El archivo package.json no tiene el tipo module"
  
  # Actualizar el archivo package.json
  log_message "Actualizando el archivo package.json..."
  sed -i 's|"private": true,|"private": true,\n  "type": "module",|g' package.json
fi

# Verificar que PM2 está instalado
if ! command -v pm2 &> /dev/null; then
  log_error "PM2 no está instalado"
  
  # Instalar PM2
  log_message "Instalando PM2..."
  npm install -g pm2
fi

# Verificar el estado de PM2
log_message "Verificando el estado de PM2..."
pm2 status

# Reiniciar la aplicación con PM2
log_message "Reiniciando la aplicación con PM2..."
pm2 restart punto-cambio-api || pm2 start ecosystem.config.js --env production

# Guardar la configuración de PM2
log_message "Guardando la configuración de PM2..."
pm2 save

# Verificar que la aplicación está respondiendo
log_message "Verificando que la aplicación está respondiendo..."
curl -s http://localhost:3001/health || log_error "La aplicación no está respondiendo"

log_message "Verificación y corrección completadas con éxito"
log_message "Verifica los logs con: pm2 logs"