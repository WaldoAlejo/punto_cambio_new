#!/bin/bash

# Script para iniciar el servidor simple con PM2
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

# Detener la aplicación actual
log_message "Deteniendo la aplicación actual..."
pm2 stop all || true
pm2 delete all || true

# Verificar que el archivo simple-server.js existe
if [ ! -f "simple-server.js" ]; then
  log_error "El archivo simple-server.js no existe"
  exit 1
fi

# Iniciar el servidor simple con PM2
log_message "Iniciando el servidor simple con PM2..."
pm2 start simple-server.js --name punto-cambio-api

# Guardar la configuración de PM2
log_message "Guardando la configuración de PM2..."
pm2 save

# Verificar el estado de la aplicación
log_message "Verificando el estado de la aplicación..."
pm2 status

# Verificar que la aplicación está respondiendo
log_message "Verificando que la aplicación está respondiendo..."
curl -s http://localhost:3001/health || log_error "La aplicación no está respondiendo"

log_message "Servidor simple iniciado con éxito"
log_message "Verifica los logs con: pm2 logs"