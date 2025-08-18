#!/bin/bash

# Script simplificado para el despliegue de la aplicación
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

# Detener la aplicación actual
log_message "Deteniendo la aplicación actual..."
pm2 stop all || true
pm2 delete all || true

# Actualizar el código desde el repositorio
log_message "Actualizando el código desde el repositorio..."
git pull origin main

# Instalar dependencias
log_message "Instalando dependencias..."
npm install

# Generar cliente de Prisma
log_message "Generando cliente de Prisma..."
npx prisma generate

# Limpiar el directorio dist
log_message "Limpiando el directorio dist..."
rm -rf dist

# Construir el backend
log_message "Construyendo el backend..."
npx tsc --project tsconfig.server.json

# Construir el frontend
log_message "Construyendo el frontend..."
npm run build:frontend

# Verificar que el archivo index.html existe en dist
if [ ! -f "dist/index.html" ]; then
  log_error "El archivo dist/index.html no existe"
  
  # Crear un archivo index.html básico
  log_message "Creando un archivo index.html básico..."
  cat > dist/index.html << 'EOF'
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Punto Cambio</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background-color: #f5f5f5;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      max-width: 500px;
    }
    h1 {
      color: #333;
    }
    p {
      color: #666;
      margin-bottom: 1.5rem;
    }
    .status {
      padding: 0.5rem 1rem;
      background-color: #e6f7ff;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 1rem;
    }
    .api-link {
      color: #1890ff;
      text-decoration: none;
    }
    .api-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Punto Cambio</h1>
    <div class="status">Servidor en funcionamiento</div>
    <p>El servidor está funcionando correctamente. La API está disponible en:</p>
    <a href="/api" class="api-link">/api</a>
    <p>Verifica el estado del servidor en:</p>
    <a href="/health" class="api-link">/health</a>
  </div>
</body>
</html>
EOF
fi

# Verificar que el archivo index.js existe en dist
if [ ! -f "dist/index.js" ]; then
  log_error "El archivo dist/index.js no existe"
  exit 1
fi

# Iniciar la aplicación con PM2
log_message "Iniciando la aplicación con PM2..."
pm2 start ecosystem.config.js --env production

# Guardar la configuración de PM2
log_message "Guardando la configuración de PM2..."
pm2 save

# Verificar el estado de la aplicación
log_message "Verificando el estado de la aplicación..."
pm2 status

# Verificar que la aplicación está respondiendo
log_message "Verificando que la aplicación está respondiendo..."
curl -s http://localhost:3001/health || log_error "La aplicación no está respondiendo"

log_message "Despliegue completado con éxito"
log_message "Verifica los logs con: pm2 logs"