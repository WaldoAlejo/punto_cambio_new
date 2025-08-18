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

# Instalar dependencias
log_message "Instalando dependencias..."
npm install

# Verificar que existen los archivos de configuración de TypeScript
if [ ! -f "tsconfig.app.json" ]; then
  log_message "Creando archivo tsconfig.app.json..."
  cat > tsconfig.app.json << 'EOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "jsx": "react-jsx",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.d.ts"],
  "exclude": ["node_modules", "dist", "server"]
}
EOF
fi

# Generar cliente de Prisma
log_message "Generando cliente de Prisma..."
npx prisma generate

# Limpiar la base de datos y ejecutar el seed completo
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

# Construir el backend primero
log_message "Construyendo el backend..."
npm run build:server

# Construir el frontend
log_message "Construyendo el frontend..."
npm run build:frontend || {
  log_error "Error al construir el frontend. Intentando con modo de desarrollo..."
  npm run build:dev
}

# Iniciar la aplicación con PM2
log_message "Iniciando la aplicación con PM2..."
pm2 start ecosystem.config.js --env production

# Guardar la configuración de PM2
log_message "Guardando la configuración de PM2..."
pm2 save

# Configurar cron job para monitorear conexiones a la base de datos
log_message "Configurando cron job para monitorear conexiones a la base de datos..."
(crontab -l 2>/dev/null | grep -v "monitor-db-connections.js"; echo "0 * * * * cd $(pwd) && /usr/bin/node scripts/monitor-db-connections.js >> logs/db-monitor.log 2>&1") | crontab -

# Verificar el estado de la aplicación
log_message "Verificando el estado de la aplicación..."
pm2 status

# Probar la conexión a la base de datos
log_message "Probando la conexión a la base de datos..."
node scripts/test-db-connection.js || log_warning "Error al probar la conexión a la base de datos"

log_message "Despliegue completado con éxito"
log_message "Verifica los logs con: pm2 logs"