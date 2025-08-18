#!/bin/bash

# Script para configurar correctamente el frontend y el backend
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

# Detener todas las aplicaciones PM2
log_message "Deteniendo todas las aplicaciones PM2..."
pm2 stop all || true
pm2 delete all || true

# Limpiar el directorio dist
log_message "Limpiando el directorio dist..."
rm -rf dist

# Generar cliente de Prisma
log_message "Generando cliente de Prisma..."
npx prisma generate

# Construir el backend
log_message "Construyendo el backend..."
npx tsc --project tsconfig.server.json

# Construir el frontend
log_message "Construyendo el frontend..."
npm run build:frontend || {
  log_error "Error al construir el frontend. Intentando con modo de desarrollo..."
  npm run build:dev
}

# Verificar la estructura de directorios
log_message "Verificando la estructura de directorios..."
find dist -type f | sort

# Verificar si existe el archivo index.js para el backend
BACKEND_INDEX=$(find dist -name "index.js" | head -1)
if [ -z "$BACKEND_INDEX" ]; then
  log_error "No se pudo encontrar el archivo index.js para el backend"
  exit 1
fi

log_message "Archivo index.js para el backend encontrado en $BACKEND_INDEX"

# Verificar si existe el archivo index.html para el frontend
if [ ! -f "dist/index.html" ]; then
  log_error "No se pudo encontrar el archivo index.html para el frontend"
  exit 1
fi

log_message "Archivo index.html para el frontend encontrado en dist/index.html"

# Iniciar el backend con PM2
log_message "Iniciando el backend con PM2..."
pm2 start $BACKEND_INDEX --name punto-cambio-api --env production

# Verificar si el backend está en ejecución
if ! pm2 list | grep -q "punto-cambio-api"; then
  log_error "El backend no se inició correctamente"
  exit 1
fi

log_message "Backend iniciado correctamente"

# Guardar la configuración de PM2
log_message "Guardando la configuración de PM2..."
pm2 save

# Verificar si el backend está respondiendo
log_message "Verificando si el backend está respondiendo..."
if curl -s http://localhost:3001/health | grep -q "OK"; then
  log_message "El backend está respondiendo correctamente"
else
  log_warning "El backend no está respondiendo correctamente"
  
  # Verificar los logs
  log_message "Verificando los logs..."
  pm2 logs punto-cambio-api --lines 20
fi

log_message "Configuración del frontend y backend completada"
log_message "Para acceder a la aplicación, visita http://35.238.95.118:3001"