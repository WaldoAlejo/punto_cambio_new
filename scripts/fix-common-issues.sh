#!/bin/bash

# Script para solucionar problemas comunes en la aplicación
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

# Verificar conexión a la base de datos
log_message "Verificando conexión a la base de datos..."
if node -e "
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT 1').then(() => {
  console.log('Conexión exitosa a la base de datos');
  process.exit(0);
}).catch(err => {
  console.error('Error de conexión a la base de datos:', err);
  process.exit(1);
});
"; then
  log_message "Conexión a la base de datos OK"
else
  log_error "Error de conexión a la base de datos"
  log_message "Intentando solucionar..."
  
  # Verificar si el servicio de PostgreSQL está activo
  if systemctl is-active postgresql > /dev/null; then
    log_message "PostgreSQL está activo"
  else
    log_warning "PostgreSQL no está activo, intentando iniciar..."
    sudo systemctl start postgresql
  fi
  
  # Verificar variables de entorno
  if [ -z "$DATABASE_URL" ]; then
    log_warning "Variable DATABASE_URL no está definida en el entorno"
    if [ -f ".env.production" ]; then
      log_message "Cargando variables desde .env.production"
      export $(grep -v '^#' .env.production | xargs)
    elif [ -f ".env" ]; then
      log_message "Cargando variables desde .env"
      export $(grep -v '^#' .env | xargs)
    else
      log_error "No se encontró archivo .env o .env.production"
    fi
  fi
fi

# Monitorear conexiones a la base de datos
log_message "Monitoreando conexiones a la base de datos..."
node scripts/monitor-db-connections.js

# Verificar estado de PM2
log_message "Verificando estado de PM2..."
if pm2 status | grep -q "punto-cambio-api"; then
  log_message "PM2 está ejecutando la aplicación"
else
  log_warning "PM2 no está ejecutando la aplicación, intentando iniciar..."
  pm2 start ecosystem.config.js
  pm2 save
fi

# Verificar espacio en disco
log_message "Verificando espacio en disco..."
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
  log_warning "Espacio en disco crítico: ${DISK_USAGE}%"
  log_message "Limpiando archivos temporales..."
  rm -rf /tmp/*
  rm -rf logs/*.log.* 2>/dev/null
else
  log_message "Espacio en disco OK: ${DISK_USAGE}%"
fi

# Verificar memoria disponible
log_message "Verificando memoria disponible..."
FREE_MEM=$(free -m | awk 'NR==2 {print $4}')
if [ "$FREE_MEM" -lt 200 ]; then
  log_warning "Memoria disponible crítica: ${FREE_MEM}MB"
  log_message "Limpiando caché de memoria..."
  sync && echo 3 | sudo tee /proc/sys/vm/drop_caches > /dev/null
else
  log_message "Memoria disponible OK: ${FREE_MEM}MB"
fi

# Reiniciar la aplicación si es necesario
read -p "¿Deseas reiniciar la aplicación? (s/n): " RESTART
if [ "$RESTART" = "s" ] || [ "$RESTART" = "S" ]; then
  log_message "Reiniciando la aplicación..."
  pm2 restart all
  log_message "Aplicación reiniciada"
fi

log_message "Verificación y solución de problemas completada"