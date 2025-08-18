#!/bin/bash

# Script para verificar la integridad del sistema
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

# Verificar archivos de configuración
log_message "Verificando archivos de configuración..."
FILES_TO_CHECK=("package.json" "tsconfig.json" "tsconfig.app.json" "tsconfig.node.json" "tsconfig.server.json" "vite.config.ts" "ecosystem.config.js")
MISSING_FILES=()

for file in "${FILES_TO_CHECK[@]}"; do
  if [ ! -f "$file" ]; then
    MISSING_FILES+=("$file")
  fi
done

if [ ${#MISSING_FILES[@]} -eq 0 ]; then
  log_message "Todos los archivos de configuración están presentes"
else
  log_warning "Faltan los siguientes archivos de configuración:"
  for file in "${MISSING_FILES[@]}"; do
    echo "  - $file"
  done
fi

# Verificar variables de entorno
log_message "Verificando variables de entorno..."
if [ -f ".env.production" ]; then
  log_message "Archivo .env.production encontrado"
  source .env.production
elif [ -f ".env.local" ]; then
  log_message "Archivo .env.local encontrado"
  source .env.local
elif [ -f ".env" ]; then
  log_message "Archivo .env encontrado"
  source .env
else
  log_error "No se encontró ningún archivo de variables de entorno"
fi

# Verificar variables de entorno requeridas
REQUIRED_VARS=("DATABASE_URL" "JWT_SECRET" "PORT")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    MISSING_VARS+=("$var")
  fi
done

if [ ${#MISSING_VARS[@]} -eq 0 ]; then
  log_message "Todas las variables de entorno requeridas están definidas"
else
  log_warning "Faltan las siguientes variables de entorno:"
  for var in "${MISSING_VARS[@]}"; do
    echo "  - $var"
  done
fi

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
fi

# Verificar estado de PM2
log_message "Verificando estado de PM2..."
if pm2 status | grep -q "punto-cambio-api"; then
  log_message "PM2 está ejecutando la aplicación"
else
  log_warning "PM2 no está ejecutando la aplicación"
fi

# Verificar espacio en disco
log_message "Verificando espacio en disco..."
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
  log_warning "Espacio en disco crítico: ${DISK_USAGE}%"
else
  log_message "Espacio en disco OK: ${DISK_USAGE}%"
fi

# Verificar memoria disponible
log_message "Verificando memoria disponible..."
FREE_MEM=$(free -m | awk 'NR==2 {print $4}')
if [ "$FREE_MEM" -lt 200 ]; then
  log_warning "Memoria disponible crítica: ${FREE_MEM}MB"
else
  log_message "Memoria disponible OK: ${FREE_MEM}MB"
fi

# Verificar puertos en uso
log_message "Verificando puertos en uso..."
if netstat -tuln | grep -q ":3001"; then
  log_message "Puerto 3001 en uso (API)"
else
  log_warning "Puerto 3001 no está en uso (API no está ejecutándose)"
fi

# Verificar logs
log_message "Verificando logs..."
if [ -d "logs" ]; then
  LOG_SIZE=$(du -sh logs | awk '{print $1}')
  log_message "Tamaño de logs: ${LOG_SIZE}"
  
  # Verificar si hay errores en los logs
  if grep -q "ERROR" logs/error.log 2>/dev/null; then
    log_warning "Se encontraron errores en los logs"
    echo "Últimos 5 errores:"
    grep "ERROR" logs/error.log | tail -5
  else
    log_message "No se encontraron errores en los logs"
  fi
else
  log_warning "Directorio de logs no encontrado"
fi

log_message "Verificación del sistema completada"