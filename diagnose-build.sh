#!/bin/bash
set -e

echo "🔍 ====== DIAGNÓSTICO DE BUILD ======"
echo ""

# 1. Verificar archivos fuente
echo "1️⃣  Verificar server/index.ts"
if [ -f "server/index.ts" ]; then
  echo "✅ server/index.ts existe"
else
  echo "❌ server/index.ts NO EXISTE"
  exit 1
fi

# 2. Verificar tsconfig
echo ""
echo "2️⃣  Verificar tsconfig.server.json"
if [ -f "tsconfig.server.json" ]; then
  echo "✅ tsconfig.server.json existe"
  grep -A2 '"include"' tsconfig.server.json
else
  echo "❌ tsconfig.server.json NO EXISTE"
  exit 1
fi

# 3. Limpiar caches
echo ""
echo "3️⃣  Limpiar caches y directorios"
rm -f tsconfig.server.tsbuildinfo
rm -rf dist-server/
echo "✅ Cache limpiado"

# 4. Generar Prisma client
echo ""
echo "4️⃣  Generar Prisma Client"
npx prisma generate --schema=prisma/schema.prisma

# 5. Compilar TypeScript con diagnostics
echo ""
echo "5️⃣  Compilar TypeScript"
npx tsc -p tsconfig.server.json --listFilesOnly 2>&1 | head -20

# 6. Verificar archivos compilados
echo ""
echo "6️⃣  Verificar archivos compilados"
if [ -f "dist-server/server/index.js" ]; then
  echo "✅ dist-server/server/index.js EXISTE"
  ls -lh dist-server/server/index.js
else
  echo "❌ dist-server/server/index.js NO EXISTE"
  echo "Listando contenido de dist-server:"
  find dist-server -type f -name "*.js" | head -10
fi

# 7. Contar archivos compilados
echo ""
echo "7️⃣  Estadísticas de compilación"
TOTAL_JS=$(find dist-server -name "*.js" | wc -l)
echo "Total de archivos .js compilados: $TOTAL_JS"

echo ""
echo "🔍 ====== FIN DEL DIAGNÓSTICO ======"