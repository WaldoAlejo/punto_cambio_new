#!/bin/bash

echo "🚀 DEPLOY DEFINITIVO - PUNTO CAMBIO"
echo "=================================="

# Detener todos los procesos PM2
echo "📛 Deteniendo procesos PM2..."
pm2 delete all 2>/dev/null || true

# Instalar dependencias si no existen
echo "📦 Verificando dependencias..."
if [ ! -d "node_modules" ]; then
    echo "Instalando dependencias..."
    npm install
fi

# Verificar que vite y tsx estén disponibles
echo "🔧 Verificando herramientas..."
npx vite --version
npx tsx --version

# Construir el frontend
echo "🏗️ Construyendo frontend..."
npm run build

# Construir el backend
echo "🏗️ Construyendo backend..."
npm run build:server

# Iniciar backend con PM2
echo "🚀 Iniciando backend..."
pm2 start ecosystem.config.js --env production

# Servir frontend con PM2
echo "🚀 Iniciando frontend..."
pm2 serve dist 3000 --name frontend --spa

# Verificar estado
echo "✅ Verificando estado..."
pm2 status

# Guardar configuración
echo "💾 Guardando configuración PM2..."
pm2 save

echo ""
echo "🎉 DEPLOY COMPLETADO!"
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:3001"
echo ""
echo "Para ver logs:"
echo "pm2 logs frontend"
echo "pm2 logs punto-cambio-api"