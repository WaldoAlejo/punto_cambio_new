#!/bin/bash

# Script para crear un nuevo archivo ecosystem.config.js
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

# Buscar el archivo index.js en el directorio dist
INDEX_FILE=$(find dist -name "index.js" | head -1)
if [ -z "$INDEX_FILE" ]; then
  log_error "No se pudo encontrar el archivo index.js en el directorio dist"
  exit 1
fi

log_message "Archivo index.js encontrado en $INDEX_FILE"

# Crear un nuevo archivo ecosystem.config.js
log_message "Creando un nuevo archivo ecosystem.config.js..."

cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: "punto-cambio-api",
      script: "${INDEX_FILE}",
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

log_message "Archivo ecosystem.config.js creado correctamente"

# Verificar si PM2 está instalado
if ! command -v pm2 &> /dev/null; then
  log_error "PM2 no está instalado"
  log_message "Instalando PM2..."
  npm install -g pm2
else
  log_message "PM2 está instalado"
fi

# Detener la aplicación si está en ejecución
if pm2 list | grep -q "punto-cambio-api"; then
  log_message "Deteniendo la aplicación..."
  pm2 stop punto-cambio-api
  pm2 delete punto-cambio-api
fi

# Iniciar la aplicación con PM2
log_message "Iniciando la aplicación con PM2..."
pm2 start ecosystem.config.js --env production

# Guardar la configuración de PM2
log_message "Guardando la configuración de PM2..."
pm2 save

log_message "Proceso completado con éxito"