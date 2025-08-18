#!/bin/bash

# Script para verificar el estado del servidor
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

# Verificar el estado de PM2
log_message "Verificando el estado de PM2..."
pm2 status

# Verificar que la aplicación está respondiendo
log_message "Verificando que la aplicación está respondiendo..."
curl -s http://localhost:3001/health || log_error "La aplicación no está respondiendo"

# Verificar los logs de PM2
log_message "Verificando los logs de PM2..."
pm2 logs --lines 20

# Verificar el uso de memoria
log_message "Verificando el uso de memoria..."
free -h

# Verificar el uso de disco
log_message "Verificando el uso de disco..."
df -h

# Verificar los procesos en ejecución
log_message "Verificando los procesos en ejecución..."
ps aux | grep node

# Verificar los puertos en uso
log_message "Verificando los puertos en uso..."
netstat -tuln | grep LISTEN

log_message "Verificación completada con éxito"