#!/bin/bash

# Script para verificar y corregir problemas específicos del frontend
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

# Verificar que el archivo src/config/environment.ts existe
if [ ! -f "src/config/environment.ts" ]; then
  log_error "El archivo src/config/environment.ts no existe"
  exit 1
fi

# Verificar que el archivo src/services/axiosInstance.ts existe
if [ ! -f "src/services/axiosInstance.ts" ]; then
  log_error "El archivo src/services/axiosInstance.ts no existe"
  exit 1
fi

# Verificar que el archivo .env.production existe
if [ ! -f ".env.production" ]; then
  log_error "El archivo .env.production no existe"
  
  # Crear el archivo .env.production
  log_message "Creando el archivo .env.production..."
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
fi

# Verificar que el archivo .env.local existe
if [ ! -f ".env.local" ]; then
  log_error "El archivo .env.local no existe"
  
  # Crear el archivo .env.local
  log_message "Creando el archivo .env.local..."
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
fi

# Verificar que el archivo .env existe
if [ ! -f ".env" ]; then
  log_error "El archivo .env no existe"
  
  # Crear el archivo .env
  log_message "Creando el archivo .env..."
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
fi

# Verificar que el archivo src/config/environment.ts tiene la URL de la API correcta
if ! grep -q "API_URL: import.meta.env.VITE_API_URL || \"http://35.238.95.118:3001/api\"" src/config/environment.ts; then
  log_warning "El archivo src/config/environment.ts no tiene la URL de la API correcta"
  
  # Actualizar el archivo src/config/environment.ts
  log_message "Actualizando el archivo src/config/environment.ts..."
  sed -i 's|API_URL: import.meta.env.VITE_API_URL || ".*"|API_URL: import.meta.env.VITE_API_URL || "http://35.238.95.118:3001/api"|g' src/config/environment.ts
fi

# Verificar que el archivo vite.config.ts existe
if [ ! -f "vite.config.ts" ]; then
  log_error "El archivo vite.config.ts no existe"
  exit 1
fi

# Verificar que el archivo vite.config.ts tiene la configuración correcta
if ! grep -q "base: \"/\"" vite.config.ts; then
  log_warning "El archivo vite.config.ts no tiene la configuración correcta"
  
  # Actualizar el archivo vite.config.ts
  log_message "Actualizando el archivo vite.config.ts..."
  sed -i 's|export default defineConfig({|export default defineConfig({\n  base: "/",|g' vite.config.ts
fi

# Verificar que el directorio dist existe
if [ ! -d "dist" ]; then
  log_error "El directorio dist no existe"
  log_message "Creando directorio dist..."
  mkdir -p dist
fi

# Verificar que el archivo dist/index.html existe
if [ ! -f "dist/index.html" ]; then
  log_error "El archivo dist/index.html no existe"
  
  # Construir el frontend
  log_message "Construyendo el frontend..."
  npm run build:frontend || log_error "Error al construir el frontend"
fi

log_message "Verificación y corrección completadas con éxito"