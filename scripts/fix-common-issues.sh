#!/bin/bash

# Script para solucionar problemas comunes en la aplicación
echo "=== SCRIPT DE SOLUCIÓN DE PROBLEMAS COMUNES ==="
echo "Este script intentará solucionar problemas comunes en la aplicación"

# Directorio raíz del proyecto
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo -e "\n1. Verificando archivos de entorno..."
# Asegurarse de que DATABASE_URL esté en todos los archivos .env
for ENV_FILE in .env .env.local .env.production; do
  if [ -f "$ENV_FILE" ]; then
    echo "  - Encontrado $ENV_FILE"
    if ! grep -q "DATABASE_URL" "$ENV_FILE"; then
      echo "    ⚠️ $ENV_FILE no contiene DATABASE_URL, agregándolo..."
      echo "DATABASE_URL=postgresql://postgres:Esh2ew8p@34.66.51.85:5432/punto_cambio" >> "$ENV_FILE"
    fi
  else
    echo "  - $ENV_FILE no existe, creándolo..."
    echo "DATABASE_URL=postgresql://postgres:Esh2ew8p@34.66.51.85:5432/punto_cambio" > "$ENV_FILE"
  fi
done

echo -e "\n2. Verificando permisos de archivos..."
# Asegurarse de que los scripts sean ejecutables
chmod +x scripts/*.sh
chmod +x *.sh
echo "  ✅ Permisos de scripts actualizados"

echo -e "\n3. Verificando logs..."
# Crear directorio de logs si no existe
if [ ! -d "logs" ]; then
  mkdir -p logs
  echo "  ✅ Directorio de logs creado"
else
  echo "  ✅ Directorio de logs existe"
fi

# Limpiar logs antiguos si ocupan demasiado espacio
LOG_SIZE=$(du -sm logs | cut -f1)
if [ "$LOG_SIZE" -gt 100 ]; then
  echo "  ⚠️ Los logs ocupan más de 100MB ($LOG_SIZE MB), limpiando logs antiguos..."
  find logs -name "*.log" -type f -mtime +7 -delete
  echo "  ✅ Logs antiguos eliminados"
fi

echo -e "\n4. Verificando conexión a la base de datos..."
# Intentar hacer ping al servidor de la base de datos
DB_HOST="34.66.51.85"
if ping -c 2 $DB_HOST > /dev/null 2>&1; then
  echo "  ✅ Conexión al servidor de base de datos ($DB_HOST) exitosa"
else
  echo "  ⚠️ No se puede conectar al servidor de base de datos ($DB_HOST)"
  echo "    - Verifica tu conexión a internet"
  echo "    - Verifica que el servidor esté en línea"
  echo "    - Verifica que no haya restricciones de firewall"
fi

echo -e "\n5. Verificando configuración de PM2..."
# Verificar si el archivo ecosystem.config.js existe y tiene la configuración correcta
if [ -f "ecosystem.config.js" ]; then
  echo "  ✅ Archivo ecosystem.config.js encontrado"
  
  # Verificar si el script apunta al archivo correcto
  if grep -q "script.*dist/index.js" ecosystem.config.js; then
    echo "  ✅ PM2 está configurado para usar dist/index.js"
  else
    echo "  ⚠️ PM2 no está configurado para usar dist/index.js"
    echo "    - Edita ecosystem.config.js y asegúrate de que script apunte a dist/index.js"
  fi
else
  echo "  ⚠️ No se encontró el archivo ecosystem.config.js"
fi

echo -e "\n6. Verificando build..."
# Verificar si el directorio dist existe y contiene los archivos necesarios
if [ -d "dist" ]; then
  if [ -f "dist/index.js" ]; then
    echo "  ✅ Build encontrado (dist/index.js existe)"
  else
    echo "  ⚠️ Build incompleto (dist/index.js no existe)"
    echo "    - Ejecuta 'npm run build' para generar el build"
  fi
else
  echo "  ⚠️ No se encontró el directorio dist"
  echo "    - Ejecuta 'npm run build' para generar el build"
fi

echo -e "\n=== VERIFICACIÓN COMPLETADA ==="
echo "Si sigues teniendo problemas, ejecuta los siguientes comandos:"
echo "1. npm run build - Para reconstruir la aplicación"
echo "2. pm2 flush - Para limpiar los logs de PM2"
echo "3. pm2 reload all - Para reiniciar todos los procesos"
echo "4. node scripts/test-db-connection.js - Para probar la conexión a la base de datos"
echo "5. node scripts/test-prisma-connection.js - Para probar la conexión con Prisma"
echo "6. node scripts/check-server-config.js - Para verificar la configuración del servidor"