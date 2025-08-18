#!/bin/bash

# Script para desplegar la aplicación completa (frontend y backend) en el servidor
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

# Actualizar el código desde el repositorio
log_message "Actualizando el código desde el repositorio..."
git pull origin main || log_warning "Error al actualizar el código desde el repositorio"

# Actualizar las variables de entorno
log_message "Actualizando las variables de entorno..."
./update-env.sh || log_warning "Error al actualizar las variables de entorno"

# Instalar dependencias
log_message "Instalando dependencias..."
npm install || log_error "Error al instalar dependencias"

# Generar cliente de Prisma
log_message "Generando cliente de Prisma..."
npx prisma generate || log_error "Error al generar cliente de Prisma"

# Limpiar el directorio dist
log_message "Limpiando el directorio dist..."
rm -rf dist

# Construir el backend
log_message "Construyendo el backend..."
npm run build:server || log_error "Error al construir el backend"

# Construir el frontend
log_message "Construyendo el frontend..."
npm run build:frontend || log_error "Error al construir el frontend"

# Verificar que el archivo index.html existe en dist
if [ ! -f "dist/index.html" ]; then
  log_error "El archivo dist/index.html no existe"
  exit 1
fi

# Verificar que el archivo index.js existe en dist
if [ ! -f "dist/index.js" ]; then
  log_error "El archivo dist/index.js no existe"
  exit 1
fi

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
curl -s http://localhost:3001/health || log_error "La aplicación no está respondiendo"

log_message "Despliegue completado con éxito"
log_message "Verifica los logs con: pm2 logs"