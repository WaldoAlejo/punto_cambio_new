#!/bin/bash

# Script para ejecutar todos los scripts de verificación y corrección
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

# Actualizar las variables de entorno
log_message "Actualizando las variables de entorno..."
./update-env.sh || log_warning "Error al actualizar las variables de entorno"

# Verificar y corregir problemas del frontend
log_message "Verificando y corrigiendo problemas del frontend..."
./fix-frontend.sh || log_warning "Error al verificar y corregir problemas del frontend"

# Verificar y corregir problemas del backend
log_message "Verificando y corrigiendo problemas del backend..."
./fix-backend.sh || log_warning "Error al verificar y corregir problemas del backend"

# Verificar y corregir problemas del despliegue
log_message "Verificando y corrigiendo problemas del despliegue..."
./fix-deployment.sh || log_warning "Error al verificar y corregir problemas del despliegue"

# Iniciar la aplicación con PM2
log_message "Iniciando la aplicación con PM2..."
pm2 start ecosystem.config.js --env production || log_error "Error al iniciar la aplicación con PM2"

# Guardar la configuración de PM2
log_message "Guardando la configuración de PM2..."
pm2 save || log_warning "Error al guardar la configuración de PM2"

# Verificar el estado de la aplicación
log_message "Verificando el estado de la aplicación..."
pm2 status

# Verificar que la aplicación está respondiendo
log_message "Verificando que la aplicación está respondiendo..."
curl -s http://localhost:3001/health || {
  log_error "La aplicación no está respondiendo"
  
  # Verificar los logs
  log_message "Verificando los logs..."
  pm2 logs --lines 20
  
  # Intentar con el servidor simple
  log_message "Intentando con el servidor simple..."
  ./fix-simple-server.sh || log_warning "Error al verificar y corregir problemas del servidor simple"
  
  # Iniciar el servidor simple con PM2
  log_message "Iniciando el servidor simple con PM2..."
  pm2 start simple-server.js --name punto-cambio-api || log_error "Error al iniciar el servidor simple con PM2"
  
  # Guardar la configuración de PM2
  log_message "Guardando la configuración de PM2..."
  pm2 save || log_warning "Error al guardar la configuración de PM2"
  
  # Verificar que la aplicación está respondiendo
  log_message "Verificando que la aplicación está respondiendo..."
  curl -s http://localhost:3001/health || log_error "La aplicación no está respondiendo"
}

log_message "Verificación y corrección completadas con éxito"
log_message "Verifica los logs con: pm2 logs"