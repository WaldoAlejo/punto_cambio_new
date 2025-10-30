#!/bin/bash

# Script de Reset Completo y Deploy - GCP
# Este script borra todo, hace pull limpio y redeploya

set -e  # Salir si hay error

echo "=================================================="
echo "🚀 RESET COMPLETO Y DEPLOY EN GCP"
echo "=================================================="

# 1. OBTENER RUTA ACTUAL
PROJECT_PATH="/home/cevallos_oswaldo/punto_cambio_new"
BACKUP_PATH="/home/cevallos_oswaldo/punto_cambio_new.backup.$(date +%s)"

echo ""
echo "1️⃣  Deteniendo PM2..."
pm2 stop all || true
pm2 delete all || true
sleep 2

echo ""
echo "2️⃣  Haciendo backup de la carpeta actual..."
if [ -d "$PROJECT_PATH" ]; then
  mv "$PROJECT_PATH" "$BACKUP_PATH"
  echo "   ✅ Backup guardado en: $BACKUP_PATH"
fi

echo ""
echo "3️⃣  Clonando repositorio limpio desde GitHub..."
cd /home/cevallos_oswaldo
git clone https://github.com/WaldoAlejo/punto_cambio_new.git
cd "$PROJECT_PATH"

echo ""
echo "4️⃣  Copiar archivos .env.production desde backup..."
if [ -f "$BACKUP_PATH/.env.production" ]; then
  cp "$BACKUP_PATH/.env.production" "$PROJECT_PATH/.env.production"
  echo "   ✅ .env.production restaurado"
else
  echo "   ⚠️  Advertencia: .env.production no encontrado en backup"
fi

echo ""
echo "5️⃣  Instalar dependencias..."
npm install

echo ""
echo "6️⃣  Generar Prisma client..."
npx prisma generate

echo ""
echo "7️⃣  Compilar backend (TypeScript)..."
npm run build:server

echo ""
echo "8️⃣  Compilar frontend..."
npm run build

echo ""
echo "9️⃣  Configurar PM2..."
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup

echo ""
echo "✅ DEPLOY COMPLETADO"
echo ""
echo "Verificar estado:"
pm2 status
echo ""
echo "Ver logs:"
echo "  pm2 logs punto-cambio-api --lines 50"