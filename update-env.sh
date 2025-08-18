#!/bin/bash

# Script para actualizar las variables de entorno en el servidor
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

# Crear o actualizar el archivo .env.production
log_message "Creando o actualizando el archivo .env.production..."
cat > .env.production << 'EOF'
# Variables de entorno para producción
DATABASE_URL=postgresql://postgres:Esh2ew8p@34.66.51.85:5432/punto_cambio
DB_USER=postgres
DB_PASSWORD=Esh2ew8p
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_TIMEOUT=30000
JWT_SECRET=s3rv13ntr3g4_super_secure_jwt_key_change_in_production
NODE_ENV=production
PORT=3001
FRONTEND_URL=http://35.238.95.118:3001
LOG_LEVEL=info
VITE_API_URL=http://35.238.95.118:3001/api
VITE_APP_NAME=Punto Cambio
VITE_APP_VERSION=1.0.0
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_MAX_REQUESTS=5
EOF

# Verificar que el archivo se creó correctamente
if [ ! -f ".env.production" ]; then
  log_error "Error al crear el archivo .env.production"
  exit 1
fi

log_message "Archivo .env.production creado correctamente"

# Crear o actualizar el archivo .env.local
log_message "Creando o actualizando el archivo .env.local..."
cat > .env.local << 'EOF'
# Variables de entorno para desarrollo local
DATABASE_URL=postgresql://postgres:Esh2ew8p@34.66.51.85:5432/punto_cambio
VITE_API_URL=http://localhost:3001/api
VITE_APP_NAME=Punto Cambio
VITE_APP_VERSION=1.0.0
NODE_ENV=development
PORT=3001
JWT_SECRET=s3rv13ntr3g4_super_secure_jwt_key_change_in_production
FRONTEND_URL=http://localhost:5173
EOF

# Verificar que el archivo se creó correctamente
if [ ! -f ".env.local" ]; then
  log_error "Error al crear el archivo .env.local"
  exit 1
fi

log_message "Archivo .env.local creado correctamente"

# Crear o actualizar el archivo .env
log_message "Creando o actualizando el archivo .env..."
cat > .env << 'EOF'
# Variables de entorno por defecto
DATABASE_URL=postgresql://postgres:Esh2ew8p@34.66.51.85:5432/punto_cambio
VITE_API_URL=http://35.238.95.118:3001/api
VITE_APP_NAME=Punto Cambio
VITE_APP_VERSION=1.0.0
NODE_ENV=production
PORT=3001
JWT_SECRET=s3rv13ntr3g4_super_secure_jwt_key_change_in_production
FRONTEND_URL=http://35.238.95.118:3001
EOF

# Verificar que el archivo se creó correctamente
if [ ! -f ".env" ]; then
  log_error "Error al crear el archivo .env"
  exit 1
fi

log_message "Archivo .env creado correctamente"

log_message "Variables de entorno actualizadas correctamente"