#!/bin/bash
set -e

echo "🚀 ====== DEPLOY A PRODUCCIÓN ======"
echo ""

# 1. Pull código
echo "1️⃣  Actualizar código..."
git pull origin main || { echo "❌ Error en git pull"; exit 1; }

# 2. Instalar dependencias
echo "2️⃣  Instalar dependencias..."
npm install --production || { echo "❌ Error en npm install"; exit 1; }

# 3. Generar Prisma client
echo "3️⃣  Generar Prisma Client..."
npx prisma generate --schema=prisma/schema.prisma || { echo "❌ Error en prisma generate"; exit 1; }

# 4. LIMPIAR CACHE DE BUILD (crucial para TypeScript)
echo "4️⃣  Limpiar caches de build..."
rm -f tsconfig.server.tsbuildinfo
rm -f tsconfig.app.tsbuildinfo
rm -rf dist/
rm -rf dist-server/
echo "✅ Caches limpiados"

# 5. Build frontend
echo "5️⃣  Compilar frontend..."
npm run build:frontend || { echo "❌ Error en build:frontend"; exit 1; }

# 6. Build backend (ahora sin cache)
echo "6️⃣  Compilar backend..."
npm run build:server || { echo "❌ Error en build:server"; exit 1; }

# 7. Verificar que existen archivos compilados
echo "7️⃣  Verificar compilación..."
if [ ! -f "dist-server/server/index.js" ]; then
  echo "❌ dist-server/server/index.js NO EXISTE!"
  exit 1
fi
JS_COUNT=$(find dist-server -name "*.js" | wc -l)
echo "✅ Compilación OK ($JS_COUNT archivos .js)"

# 8. Ejecutar migraciones si es necesario
echo "8️⃣  Verificar estado de BD..."
npx prisma db push --skip-generate --skip-validate || { echo "⚠️  Migración opcional"; }

# 9. Reiniciar PM2
echo "9️⃣  Reiniciar servidor PM2..."
pm2 stop punto-cambio-api || true
pm2 delete punto-cambio-api || true
pm2 start ecosystem.config.cjs --env production
pm2 save

# 10. Verificar logs
echo "🔟 Esperando logs..."
sleep 3
pm2 logs punto-cambio-api --lines 20 --nostream

echo ""
echo "✅ ====== DEPLOY COMPLETADO ======"