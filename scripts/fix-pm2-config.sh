#!/bin/bash

# Script para verificar y corregir la configuración de PM2
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

# Verificar que existe el archivo ecosystem.config.js
if [ ! -f "ecosystem.config.js" ]; then
  log_error "El archivo ecosystem.config.js no existe"
  
  log_message "Creando archivo ecosystem.config.js..."
  cat > ecosystem.config.js << 'EOF'
export default {
  apps: [
    {
      name: "punto-cambio-api",
      script: "dist/server/index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "development",
        PORT: 3001,
        LOG_LEVEL: "debug",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3001,
        LOG_LEVEL: "info",
        NODE_OPTIONS: "--max-old-space-size=1024",
      },
      log_file: "./logs/combined.log",
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      max_memory_restart: "1G",
      node_args: "--max-old-space-size=1024",
      watch: false,
      ignore_watch: ["node_modules", "logs", "dist", "src"],
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: "10s",
      autorestart: true,
      log_type: "json",
      time: true,
    },
  ],
};
EOF
  log_message "Archivo ecosystem.config.js creado"
else
  log_message "Archivo ecosystem.config.js encontrado"
  
  # Verificar la ruta del script en ecosystem.config.js
  SCRIPT_PATH=$(grep -o '"script": "[^"]*"' ecosystem.config.js | cut -d'"' -f4)
  log_message "Ruta del script en ecosystem.config.js: $SCRIPT_PATH"
  
  # Verificar si el archivo existe
  if [ ! -f "$SCRIPT_PATH" ]; then
    log_warning "El archivo $SCRIPT_PATH no existe. Buscando alternativas..."
    
    # Verificar si el archivo está en dist/server/index.js
    if [ -f "dist/server/index.js" ]; then
      log_message "Archivo encontrado en dist/server/index.js. Actualizando ecosystem.config.js..."
      sed -i 's|"script": "[^"]*"|"script": "dist/server/index.js"|g' ecosystem.config.js
    else
      # Buscar el archivo index.js en el directorio dist
      INDEX_FILE=$(find dist -name "index.js" | head -1)
      if [ -n "$INDEX_FILE" ]; then
        log_message "Archivo encontrado en $INDEX_FILE. Actualizando ecosystem.config.js..."
        sed -i "s|\"script\": \"[^\"]*\"|\"script\": \"$INDEX_FILE\"|g" ecosystem.config.js
      else
        log_error "No se pudo encontrar el archivo index.js en el directorio dist. Verificando la estructura de directorios..."
        find dist -type f | sort
        log_error "La aplicación no se iniciará correctamente sin este archivo."
      fi
    fi
  else
    log_message "El archivo $SCRIPT_PATH existe"
  fi
fi

# Verificar si PM2 está instalado
if ! command -v pm2 &> /dev/null; then
  log_error "PM2 no está instalado"
  log_message "Instalando PM2..."
  npm install -g pm2
else
  log_message "PM2 está instalado"
fi

# Verificar si la aplicación está en ejecución
if pm2 list | grep -q "punto-cambio-api"; then
  log_message "La aplicación está en ejecución"
  pm2 show punto-cambio-api
else
  log_warning "La aplicación no está en ejecución"
  
  # Preguntar si se desea iniciar la aplicación
  read -p "¿Deseas iniciar la aplicación? (s/n): " START_APP
  if [ "$START_APP" = "s" ] || [ "$START_APP" = "S" ]; then
    log_message "Iniciando la aplicación..."
    pm2 start ecosystem.config.js --env production || {
      log_error "Error al iniciar la aplicación con ecosystem.config.js. Intentando con el comando directo..."
      
      # Buscar el archivo index.js en el directorio dist
      INDEX_FILE=$(find dist -name "index.js" | head -1)
      if [ -n "$INDEX_FILE" ]; then
        log_message "Iniciando la aplicación con $INDEX_FILE..."
        pm2 start $INDEX_FILE --name punto-cambio-api --env production
      else
        log_error "No se pudo encontrar el archivo index.js en el directorio dist."
      fi
    }
    
    # Guardar la configuración de PM2
    log_message "Guardando la configuración de PM2..."
    pm2 save
  fi
fi

log_message "Verificación y corrección de la configuración de PM2 completada"