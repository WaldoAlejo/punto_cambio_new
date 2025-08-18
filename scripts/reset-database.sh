#!/bin/bash

# Script para limpiar la base de datos y ejecutar el seed completo
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

# Confirmar la acción
log_warning "¡ADVERTENCIA! Este script eliminará todos los datos de la base de datos y cargará datos iniciales."
log_warning "Esta acción no se puede deshacer."
read -p "¿Estás seguro de que deseas continuar? (s/n): " CONFIRM

if [ "$CONFIRM" != "s" ] && [ "$CONFIRM" != "S" ]; then
  log_message "Operación cancelada"
  exit 0
fi

# Crear un respaldo de la base de datos actual
log_message "Creando respaldo de la base de datos actual..."
BACKUP_DIR="$HOME/backups/database"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/punto_cambio_db_backup_$(date +%Y%m%d_%H%M%S).sql"

# Extraer información de conexión de DATABASE_URL
if [ -f ".env.production" ]; then
  source .env.production
elif [ -f ".env.local" ]; then
  source .env.local
elif [ -f ".env" ]; then
  source .env
else
  log_error "No se encontró ningún archivo de variables de entorno"
  exit 1
fi

if [ -z "$DATABASE_URL" ]; then
  log_error "Variable DATABASE_URL no está definida en el entorno"
  exit 1
fi

# Extraer información de conexión
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*@[^:]*:\([^/]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Crear respaldo
PGPASSWORD=$DB_PASS pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$BACKUP_FILE" || {
  log_warning "No se pudo crear el respaldo de la base de datos. Continuando de todos modos..."
}

if [ -f "$BACKUP_FILE" ]; then
  log_message "Respaldo de la base de datos creado en $BACKUP_FILE"
fi

# Generar cliente de Prisma
log_message "Generando cliente de Prisma..."
npx prisma generate

# Limpiar la base de datos
log_message "Limpiando la base de datos..."
npx prisma db push --force-reset

# Ejecutar seed completo
log_message "Ejecutando seed completo..."
npm run seed:complete

log_message "Base de datos limpiada y datos iniciales cargados correctamente"

# Verificar la base de datos
log_message "Verificando la base de datos..."
node scripts/test-prisma-connection.js

log_message "Proceso completado con éxito"