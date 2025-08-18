#!/bin/bash

# Script para detener la aplicación
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

# Verificar si la aplicación está en ejecución
if ! pm2 list | grep -q "punto-cambio-api"; then
  log_message "La aplicación no está en ejecución"
  exit 0
fi

# Detener la aplicación con PM2
log_message "Deteniendo la aplicación con PM2..."
pm2 stop punto-cambio-api || {
  log_error "Error al detener la aplicación con PM2. Intentando detener todos los procesos..."
  pm2 stop all || log_error "Error al detener todos los procesos"
}

# Guardar la configuración de PM2
log_message "Guardando la configuración de PM2..."
pm2 save

# Verificar el estado de la aplicación
log_message "Verificando el estado de la aplicación..."
pm2 status

log_message "Aplicación detenida con éxito"