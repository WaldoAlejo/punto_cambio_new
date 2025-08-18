#!/bin/bash

# Script para verificar y corregir problemas específicos del backend
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

# Verificar que el archivo server/index.ts existe
if [ ! -f "server/index.ts" ]; then
  log_error "El archivo server/index.ts no existe"
  exit 1
fi

# Verificar que el archivo tsconfig.server.json existe
if [ ! -f "tsconfig.server.json" ]; then
  log_error "El archivo tsconfig.server.json no existe"
  
  # Crear el archivo tsconfig.server.json
  log_message "Creando el archivo tsconfig.server.json..."
  cat > tsconfig.server.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Node",
    "outDir": "./dist",
    "rootDir": "./server",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true,
    "allowImportingTsExtensions": false,
    "noEmit": false
  },
  "include": ["server/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF
fi

# Verificar que el archivo ecosystem.config.js existe
if [ ! -f "ecosystem.config.js" ]; then
  log_error "El archivo ecosystem.config.js no existe"
  
  # Crear el archivo ecosystem.config.js
  log_message "Creando el archivo ecosystem.config.js..."
  cat > ecosystem.config.js << 'EOF'
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

# Verificar que el archivo server/index.ts tiene la configuración CORS correcta
if ! grep -q "http://35.238.95.118:3001" server/index.ts; then
  log_warning "El archivo server/index.ts no tiene la configuración CORS correcta"
  
  # Actualizar el archivo server/index.ts
  log_message "Actualizando el archivo server/index.ts..."
  sed -i 's|origin: \[|origin: \[\n      "http://35.238.95.118:3001",\n      "http://35.238.95.118:8080",\n      "http://35.238.95.118",|g' server/index.ts
fi

# Verificar que el archivo server/index.ts tiene la configuración de puerto correcta
if ! grep -q "const PORT: number = Number(process.env.PORT) || 3001;" server/index.ts; then
  log_warning "El archivo server/index.ts no tiene la configuración de puerto correcta"
  
  # Actualizar el archivo server/index.ts
  log_message "Actualizando el archivo server/index.ts..."
  sed -i 's|const PORT = .*|const PORT: number = Number(process.env.PORT) || 3001;|g' server/index.ts
fi

# Verificar que el archivo server/index.ts tiene la configuración de escucha correcta
if ! grep -q "app.listen(PORT, \"0.0.0.0\"" server/index.ts; then
  log_warning "El archivo server/index.ts no tiene la configuración de escucha correcta"
  
  # Actualizar el archivo server/index.ts
  log_message "Actualizando el archivo server/index.ts..."
  sed -i 's|app.listen(PORT|app.listen(PORT, "0.0.0.0"|g' server/index.ts
fi

# Verificar que el directorio dist existe
if [ ! -d "dist" ]; then
  log_error "El directorio dist no existe"
  log_message "Creando directorio dist..."
  mkdir -p dist
fi

# Verificar que el archivo dist/index.js existe
if [ ! -f "dist/index.js" ]; then
  log_error "El archivo dist/index.js no existe"
  
  # Construir el backend
  log_message "Construyendo el backend..."
  npm run build:server || log_error "Error al construir el backend"
fi

# Verificar que el archivo package.json tiene el script build:server
if ! grep -q "\"build:server\":" package.json; then
  log_warning "El archivo package.json no tiene el script build:server"
  
  # Actualizar el archivo package.json
  log_message "Actualizando el archivo package.json..."
  sed -i 's|"build:frontend": "vite build",|"build:frontend": "vite build",\n    "build:server": "tsc --project tsconfig.server.json",|g' package.json
fi

# Verificar que el archivo prisma/schema.prisma existe
if [ ! -f "prisma/schema.prisma" ]; then
  log_error "El archivo prisma/schema.prisma no existe"
  exit 1
fi

# Verificar que el cliente de Prisma está generado
log_message "Generando cliente de Prisma..."
npx prisma generate || log_error "Error al generar cliente de Prisma"

log_message "Verificación y corrección completadas con éxito"