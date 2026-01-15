#!/bin/bash

# Script para compilar el backend y verificar la estructura de directorios
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

# Verificar que existe el archivo tsconfig.server.json
if [ ! -f "tsconfig.server.json" ]; then
  log_error "El archivo tsconfig.server.json no existe"
  exit 1
fi

# Limpiar el directorio dist
log_message "Limpiando el directorio dist..."
rm -rf dist

# Compilar el backend
log_message "Compilando el backend..."
npx tsc --project tsconfig.server.json

# Verificar si la compilación fue exitosa
if [ $? -ne 0 ]; then
  log_error "Error al compilar el backend"
  exit 1
fi

# Verificar la estructura de directorios
log_message "Verificando la estructura de directorios..."
find dist -type f | sort

# Verificar si existe el archivo index.js
if [ -f "dist/index.js" ]; then
  log_message "El archivo dist/index.js existe"
else
  log_warning "El archivo dist/index.js no existe"
  
  # Buscar el archivo index.js en el directorio dist
  INDEX_FILE=$(find dist -name "index.js" | head -1)
  if [ -n "$INDEX_FILE" ]; then
    log_message "Archivo encontrado en $INDEX_FILE"
    
    # Actualizar ecosystem.config.js
    log_message "Actualizando ecosystem.config.js..."
    sed -i "s|\"script\": \"[^\"]*\"|\"script\": \"$INDEX_FILE\"|g" ecosystem.config.js
  else
    log_error "No se pudo encontrar el archivo index.js en el directorio dist"
    
    # Crear un archivo index.js en dist
    log_message "Creando un archivo index.js en dist..."
    cat > dist/index.js << 'EOF'
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno según el entorno
if (fs.existsSync(".env.local")) {
  console.log("Cargando variables de entorno desde .env.local");
  dotenv.config({ path: ".env.local" });
} else if (fs.existsSync(".env.production")) {
  console.log("Cargando variables de entorno desde .env.production");
  dotenv.config({ path: ".env.production" });
} else {
  console.log("Cargando variables de entorno desde .env");
  dotenv.config();
}

// Importar el servidor
import "./server/index.js";
EOF
    
    # Actualizar ecosystem.config.js
    log_message "Actualizando ecosystem.config.js..."
    sed -i 's|"script": "[^"]*"|"script": "dist/index.js"|g' ecosystem.config.js
  fi
fi

# Verificar que el archivo package.json tiene el tipo module
log_message "Verificando que el archivo package.json tiene el tipo module..."
if grep -q '"type": "module"' package.json; then
  log_message "El archivo package.json tiene el tipo module"
else
  log_warning "El archivo package.json no tiene el tipo module. Actualizando..."
  sed -i 's|"private": true,|"private": true,\n  "type": "module",|g' package.json
fi

# Crear un archivo .env.production si no existe
if [ ! -f ".env.production" ]; then
  log_warning "El archivo .env.production no existe. Creando..."
  cat > .env.production << 'EOF'
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@34.74.127.173:5432/punto_cambio
JWT_SECRET=tu_clave_secreta_jwt_muy_segura
LOG_LEVEL=info
EOF
  log_message "Archivo .env.production creado. Por favor, actualiza las credenciales de la base de datos."
fi

log_message "Compilación y verificación completadas"