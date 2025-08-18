#!/bin/bash

# Script para verificar los logs de la aplicación
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
  exit 1
fi

# Verificar si la aplicación está en ejecución
if ! pm2 list | grep -q "punto-cambio-api"; then
  log_error "La aplicación no está en ejecución"
  exit 1
fi

# Mostrar los últimos logs de error
log_message "Mostrando los últimos logs de error..."
pm2 logs punto-cambio-api --err --lines 50

# Mostrar los últimos logs de salida
log_message "Mostrando los últimos logs de salida..."
pm2 logs punto-cambio-api --out --lines 50

# Verificar los archivos de log
log_message "Verificando los archivos de log..."
if [ -f "logs/error.log" ]; then
  log_message "Mostrando los últimos errores del archivo error.log..."
  tail -n 50 logs/error.log
else
  log_warning "El archivo logs/error.log no existe"
fi

# Verificar las variables de entorno
log_message "Verificando las variables de entorno..."
if [ -f ".env.production" ]; then
  log_message "Archivo .env.production encontrado"
  # Verificar si DATABASE_URL está definido
  if grep -q "DATABASE_URL" .env.production; then
    log_message "Variable DATABASE_URL encontrada en .env.production"
  else
    log_warning "Variable DATABASE_URL no encontrada en .env.production"
  fi
else
  log_warning "Archivo .env.production no encontrado"
fi

# Verificar la conexión a la base de datos
log_message "Verificando la conexión a la base de datos..."
node -e "
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.production' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT 1').then(() => {
  console.log('Conexión exitosa a la base de datos');
  process.exit(0);
}).catch(err => {
  console.error('Error de conexión a la base de datos:', err);
  process.exit(1);
});
" || log_error "Error de conexión a la base de datos"

log_message "Verificación de logs completada"