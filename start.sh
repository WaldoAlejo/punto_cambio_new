#!/bin/bash

# Script para iniciar la aplicación
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

# Verificar si la aplicación ya está en ejecución
if pm2 list | grep -q "punto-cambio-api"; then
  log_message "La aplicación ya está en ejecución"
  pm2 status
  exit 0
fi

# Verificar que el archivo dist/index.js existe
if [ ! -f "dist/index.js" ]; then
  log_error "El archivo dist/index.js no existe. Ejecuta ./deploy.sh primero"
  exit 1
fi

# Crear un archivo ecosystem.config.js simple si no existe
if [ ! -f "ecosystem.config.js" ]; then
  log_message "Creando archivo ecosystem.config.js simple..."
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
      watch: false
    }
  ]
};
EOF
fi

# Iniciar la aplicación con PM2
log_message "Iniciando la aplicación con PM2..."
pm2 start ecosystem.config.js --env production || {
  log_error "Error al iniciar la aplicación con PM2. Intentando directamente..."
  pm2 start dist/index.js --name punto-cambio-api || log_error "Error al iniciar la aplicación con PM2"
}

# Guardar la configuración de PM2
log_message "Guardando la configuración de PM2..."
pm2 save

# Verificar el estado de la aplicación
log_message "Verificando el estado de la aplicación..."
pm2 status

# Verificar que la aplicación está respondiendo
log_message "Verificando que la aplicación está respondiendo..."
curl -s http://localhost:3001/health || log_error "La aplicación no está respondiendo"

log_message "Aplicación iniciada con éxito"
log_message "Verifica los logs con: pm2 logs"