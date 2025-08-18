#!/bin/bash

# Script para verificar y corregir los problemas de CORS
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

# Verificar si el archivo server/index.ts existe
if [ ! -f "server/index.ts" ]; then
  log_error "El archivo server/index.ts no existe"
  exit 1
fi

# Verificar la configuración de CORS en server/index.ts
log_message "Verificando la configuración de CORS en server/index.ts..."
if grep -q "cors({" server/index.ts; then
  log_message "Configuración de CORS encontrada en server/index.ts"
  
  # Verificar si la IP pública está en la lista de orígenes permitidos
  if grep -q "35.238.95.118" server/index.ts; then
    log_message "IP pública 35.238.95.118 encontrada en la lista de orígenes permitidos"
  else
    log_warning "IP pública 35.238.95.118 no encontrada en la lista de orígenes permitidos"
    
    # Preguntar si se desea agregar la IP pública a la lista de orígenes permitidos
    read -p "¿Deseas agregar la IP pública 35.238.95.118 a la lista de orígenes permitidos? (s/n): " ADD_IP
    if [ "$ADD_IP" = "s" ] || [ "$ADD_IP" = "S" ]; then
      log_message "Agregando IP pública 35.238.95.118 a la lista de orígenes permitidos..."
      
      # Hacer una copia de seguridad del archivo
      cp server/index.ts server/index.ts.bak
      
      # Agregar la IP pública a la lista de orígenes permitidos
      sed -i 's|"http://35.238.95.118",|"http://35.238.95.118", "http://35.238.95.118:3001", "http://35.238.95.118:8080",|g' server/index.ts
      
      log_message "IP pública 35.238.95.118 agregada a la lista de orígenes permitidos"
      
      # Reconstruir el backend
      log_message "Reconstruyendo el backend..."
      npx tsc --project tsconfig.server.json
      
      # Reiniciar el backend
      log_message "Reiniciando el backend..."
      pm2 restart punto-cambio-api
    fi
  fi
else
  log_warning "Configuración de CORS no encontrada en server/index.ts"
fi

# Verificar si el archivo vite.config.ts existe
if [ ! -f "vite.config.ts" ]; then
  log_error "El archivo vite.config.ts no existe"
  exit 1
fi

# Verificar la configuración del servidor en vite.config.ts
log_message "Verificando la configuración del servidor en vite.config.ts..."
if grep -q "server:" vite.config.ts; then
  log_message "Configuración del servidor encontrada en vite.config.ts"
  
  # Verificar si el host está configurado para permitir conexiones externas
  if grep -q "host: \"0.0.0.0\"" vite.config.ts; then
    log_message "Host configurado para permitir conexiones externas"
  else
    log_warning "Host no configurado para permitir conexiones externas"
    
    # Preguntar si se desea configurar el host para permitir conexiones externas
    read -p "¿Deseas configurar el host para permitir conexiones externas? (s/n): " CONFIGURE_HOST
    if [ "$CONFIGURE_HOST" = "s" ] || [ "$CONFIGURE_HOST" = "S" ]; then
      log_message "Configurando el host para permitir conexiones externas..."
      
      # Hacer una copia de seguridad del archivo
      cp vite.config.ts vite.config.ts.bak
      
      # Configurar el host para permitir conexiones externas
      sed -i 's|server: {|server: {\n    host: "0.0.0.0",|g' vite.config.ts
      
      log_message "Host configurado para permitir conexiones externas"
      
      # Reconstruir el frontend
      log_message "Reconstruyendo el frontend..."
      npm run build:frontend || npm run build:dev
      
      # Reiniciar el backend
      log_message "Reiniciando el backend..."
      pm2 restart punto-cambio-api
    fi
  fi
else
  log_warning "Configuración del servidor no encontrada en vite.config.ts"
fi

log_message "Verificación y corrección de problemas de CORS completada"