#!/bin/bash

# Script para verificar el estado de la aplicación
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

# Verificar si PM2 está instalado
if ! command -v pm2 &> /dev/null; then
  log_error "PM2 no está instalado"
  log_message "Instalando PM2..."
  npm install -g pm2
else
  log_message "PM2 está instalado"
fi

# Verificar si la aplicación está en ejecución
if pm2 list | grep -q "punto-cambio-api"; then
  log_message "La aplicación está en ejecución"
  pm2 show punto-cambio-api
  
  # Verificar si la aplicación está respondiendo
  log_message "Verificando si la aplicación está respondiendo..."
  if curl -s http://localhost:3001/health | grep -q "OK"; then
    log_message "La aplicación está respondiendo correctamente"
  else
    log_warning "La aplicación no está respondiendo correctamente"
    
    # Verificar los logs
    log_message "Verificando los logs..."
    pm2 logs punto-cambio-api --lines 20
    
    # Preguntar si se desea reiniciar la aplicación
    read -p "¿Deseas reiniciar la aplicación? (s/n): " RESTART_APP
    if [ "$RESTART_APP" = "s" ] || [ "$RESTART_APP" = "S" ]; then
      log_message "Reiniciando la aplicación..."
      pm2 restart punto-cambio-api
    fi
  fi
else
  log_warning "La aplicación no está en ejecución"
  
  # Preguntar si se desea iniciar la aplicación
  read -p "¿Deseas iniciar la aplicación? (s/n): " START_APP
  if [ "$START_APP" = "s" ] || [ "$START_APP" = "S" ]; then
    log_message "Iniciando la aplicación..."
    
    # Buscar el archivo index.js en el directorio dist
    INDEX_FILE=$(find dist -name "index.js" | head -1)
    if [ -n "$INDEX_FILE" ]; then
      log_message "Iniciando la aplicación con $INDEX_FILE..."
      pm2 start $INDEX_FILE --name punto-cambio-api --env production
      
      # Guardar la configuración de PM2
      log_message "Guardando la configuración de PM2..."
      pm2 save
    else
      log_error "No se pudo encontrar el archivo index.js en el directorio dist"
    fi
  fi
fi

# Verificar el uso de recursos
log_message "Verificando el uso de recursos..."
pm2 monit

log_message "Verificación del estado de la aplicación completada"