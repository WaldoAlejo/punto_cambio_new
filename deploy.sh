#!/bin/bash

# Script para el despliegue de la aplicación
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

# Crear un respaldo de la aplicación actual
log_message "Creando respaldo de la aplicación actual..."
BACKUP_DIR="$HOME/backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/punto_cambio_backup_$(date +%Y%m%d_%H%M%S).tar.gz"
tar -czvf "$BACKUP_FILE" --exclude="node_modules" --exclude="dist" .
log_message "Respaldo creado en $BACKUP_FILE"

# Detener la aplicación actual
log_message "Deteniendo la aplicación actual..."
pm2 stop all || true
pm2 delete all || true

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

# Crear o actualizar el archivo .env
log_message "Creando o actualizando el archivo .env..."
cp .env.production .env

# Instalar dependencias
log_message "Instalando dependencias..."
npm install

# Generar cliente de Prisma
log_message "Generando cliente de Prisma..."
npx prisma generate

# Limpiar la base de datos y ejecutar el seed completo (opcional)
log_message "¿Deseas limpiar la base de datos y ejecutar el seed completo? (s/n)"
read -r CLEAN_DB
if [ "$CLEAN_DB" = "s" ] || [ "$CLEAN_DB" = "S" ]; then
  log_message "Limpiando la base de datos..."
  npx prisma db push --force-reset
  
  log_message "Ejecutando seed completo..."
  npm run seed:complete
  
  log_message "Base de datos limpiada y datos iniciales cargados correctamente"
else
  log_message "Omitiendo limpieza de la base de datos"
fi

# Limpiar el directorio dist
log_message "Limpiando el directorio dist..."
rm -rf dist

# Verificar que existe el archivo ecosystem.config.cjs
if [ ! -f "ecosystem.config.cjs" ]; then
  log_message "Creando archivo ecosystem.config.cjs..."
  cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [
    {
      name: "punto-cambio-api",
      script: "dist/index.js",
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
fi

# Construir el backend
log_message "Construyendo el backend..."
npm run build:server || {
  log_error "Error al construir el backend. Intentando con scripts/build-server.sh..."
  ./scripts/build-server.sh
}

# Construir el frontend
log_message "Construyendo el frontend..."
npm run build:frontend || {
  log_error "Error al construir el frontend. Intentando con modo de desarrollo..."
  npm run build:dev
}

# Iniciar la aplicación con PM2
log_message "Iniciando la aplicación con PM2..."

# Verificar que el archivo dist/index.js existe
if [ ! -f "dist/index.js" ]; then
  log_error "El archivo dist/index.js no existe"
  exit 1
fi

# Crear un archivo ecosystem.config.js simple
log_message "Creando archivo ecosystem.config.js simple..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: "punto-cambio-api",
      script: "./dist/index.js",
      instances: 1,
      exec_mode: "fork",
      env_production: {
        NODE_ENV: "production",
        PORT: 3001
      },
      watch: false
    }
  ]
};
EOF

# Iniciar la aplicación con PM2
pm2 start ecosystem.config.js --env production || {
  log_error "Error al iniciar la aplicación con PM2. Intentando directamente..."
  pm2 start dist/index.js --name punto-cambio-api || log_error "Error al iniciar la aplicación con PM2"
}

# Guardar la configuración de PM2
log_message "Guardando la configuración de PM2..."
pm2 save

# Verificar el estado de la aplicación
log_message "Verificando el estado de la aplicación..."
pm2 status

# Probar la conexión a la base de datos
log_message "Probando la conexión a la base de datos..."
node scripts/test-db-connection.js || log_warning "Error al probar la conexión a la base de datos"

log_message "Despliegue completado con éxito"
log_message "Verifica los logs con: pm2 logs"