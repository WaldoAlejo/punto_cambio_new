#!/bin/bash

# ============================================================================
# SCRIPT DE DESPLIEGUE: Fix Servientrega Balance Deduction
# Este script aplica la migración SQL y recompila el backend
# ============================================================================

set -e  # Salir en caso de error

echo "🚀 INICIANDO DESPLIEGUE DE FIX SERVIENTREGA..."
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json no encontrado. Ejecuta este script desde la raíz del proyecto.${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 PASO 1: Aplicar migración SQL a la base de datos${NC}"
echo ""

# Obtener credenciales de BD desde .env.production o .env
if [ -f ".env.production" ]; then
    source .env.production
else
    source .env
fi

# Usar DATABASE_URL directamente si existe
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ Error: DATABASE_URL no encontrado en .env.production o .env${NC}"
    exit 1
fi

echo "Intentando conectar a la BD usando DATABASE_URL"
echo "📍 BD: $(echo $DATABASE_URL | sed 's/:.*@/@/g')"
echo ""

# Aplicar migración SQL
echo "Ejecutando migración: 2025-10-29-make-servientrega-guia-fks-optional.sql"
PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "punto_cambio" < ./server/migrations/2025-10-29-make-servientrega-guia-fks-optional.sql 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migración aplicada exitosamente${NC}"
else
    echo -e "${YELLOW}⚠️  La migración puede haber fallado. Continuando con verificación...${NC}"
fi

echo ""
echo -e "${YELLOW}📋 PASO 2: Verificar que los cambios se aplicaron${NC}"
echo ""

# Verificar que los campos son ahora nullable
PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "punto_cambio" -c \
"SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'ServientregaGuia' 
AND column_name IN ('remitente_id', 'destinatario_id', 'punto_atencion_id')
ORDER BY ordinal_position;" 2>&1

echo ""
echo -e "${YELLOW}📋 PASO 3: Regenerar cliente Prisma${NC}"
echo ""

npx prisma generate

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Cliente Prisma regenerado exitosamente${NC}"
else
    echo -e "${RED}❌ Error al regenerar cliente Prisma${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📋 PASO 4: Recompilando backend TypeScript${NC}"
echo ""

npm run build:server

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend compilado exitosamente${NC}"
else
    echo -e "${RED}❌ Error en la compilación del backend${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📋 PASO 5: Reiniciando PM2${NC}"
echo ""

pm2 restart punto-cambio-api

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ PM2 reiniciado exitosamente${NC}"
else
    echo -e "${RED}❌ Error al reiniciar PM2${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📋 PASO 6: Mostrando logs de PM2${NC}"
echo ""

pm2 logs punto-cambio-api --lines 50

echo ""
echo -e "${GREEN}✅ DESPLIEGUE COMPLETADO${NC}"
echo ""
echo "🎯 PRÓXIMOS PASOS:"
echo "1. Genera una guía de prueba en la aplicación"
echo "2. Busca estos logs: '🔍 [descontarSaldo]' y '✅ Saldo descontado'"
echo "3. Verifica que el saldo se haya descontado correctamente"
echo ""
echo "Para ver los logs en tiempo real:"
echo "  pm2 logs punto-cambio-api"
echo ""