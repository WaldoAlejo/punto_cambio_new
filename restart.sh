#!/bin/bash

# Script para reiniciar la aplicación
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

# Reiniciar la aplicación con PM2
log_message "Reiniciando la aplicación con PM2..."
pm2 restart punto-cambio-api || {
  log_error "Error al reiniciar la aplicación con PM2. Intentando iniciar..."
  pm2 start ecosystem.config.cjs --env production || {
    log_error "Error al iniciar la aplicación con PM2. Intentando con ecosystem.config.js..."
    pm2 start ecosystem.config.js --env production || log_error "Error al iniciar la aplicación con PM2"
  }
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

log_message "Reinicio completado con éxito"
log_message "Verifica los logs con: pm2 logs"