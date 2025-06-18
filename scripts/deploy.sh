
#!/bin/bash

# Script de despliegue para producción
set -e

echo "🚀 Iniciando despliegue de Punto Cambio API..."

# Verificar que estamos en la rama correcta
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ] && [ "$BRANCH" != "production" ]; then
    echo "❌ Error: Debe estar en la rama 'main' o 'production' para desplegar"
    exit 1
fi

# Crear directorio de logs si no existe
mkdir -p logs

# Verificar variables de entorno críticas
if [ -z "$DATABASE_URL" ] || [ -z "$JWT_SECRET" ]; then
    echo "❌ Error: Variables de entorno DATABASE_URL y JWT_SECRET son requeridas"
    exit 1
fi

# Instalar dependencias
echo "📦 Instalando dependencias..."
npm ci --only=production

# Ejecutar migraciones de base de datos
echo "🗄️ Ejecutando migraciones..."
npx prisma migrate deploy
npx prisma generate

# Construir aplicación si es necesario
echo "🔨 Preparando aplicación..."

# Verificar salud de la base de datos
echo "🔍 Verificando conexión a base de datos..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.usuario.count().then(() => {
    console.log('✅ Conexión a base de datos exitosa');
    process.exit(0);
}).catch((error) => {
    console.error('❌ Error de conexión a base de datos:', error.message);
    process.exit(1);
});
"

# Detener PM2 si está corriendo
echo "🛑 Deteniendo servicios anteriores..."
pm2 stop punto-cambio-api 2>/dev/null || true

# Iniciar con PM2
echo "🚀 Iniciando aplicación con PM2..."
pm2 start ecosystem.config.js --env production

# Verificar que la aplicación está corriendo
sleep 5
if pm2 list | grep -q "punto-cambio-api.*online"; then
    echo "✅ Aplicación desplegada exitosamente"
    pm2 status
    pm2 logs punto-cambio-api --lines 10
else
    echo "❌ Error: La aplicación no se inició correctamente"
    pm2 logs punto-cambio-api --lines 20
    exit 1
fi

echo "🎉 Despliegue completado exitosamente!"
