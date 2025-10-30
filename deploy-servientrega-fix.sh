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

DB_HOST=${DATABASE_URL%%@*}  # Intenta extraer del URL completo
DB_HOST=${DB_HOST##*://}    # Limpia el protocolo
DB_HOST="localhost"         # Fallback seguro

echo "Intentando conectar a la BD en: $DB_HOST"
echo ""

# Aplicar migración SQL
echo "Ejecutando migración: 2025-10-29-make-servientrega-guia-fks-optional.sql"
psql -h localhost -U cevallos_oswaldo -d punto_cambio_db < ./server/migrations/2025-10-29-make-servientrega-guia-fks-optional.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migración aplicada exitosamente${NC}"
else
    echo -e "${RED}❌ Error al aplicar migración${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📋 PASO 2: Verificar que los cambios se aplicaron${NC}"
echo ""

# Verificar que los campos son ahora nullable
psql -h localhost -U cevallos_oswaldo -d punto_cambio_db -c \
"SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'ServientregaGuia' 
AND column_name IN ('remitente_id', 'destinatario_id', 'punto_atencion_id')
ORDER BY ordinal_position;"

echo ""
echo -e "${YELLOW}📋 PASO 3: Recompilando backend TypeScript${NC}"
echo ""

npm run build:server

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend compilado exitosamente${NC}"
else
    echo -e "${RED}❌ Error en la compilación del backend${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📋 PASO 4: Reiniciando PM2${NC}"
echo ""

pm2 restart punto-cambio-api

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ PM2 reiniciado exitosamente${NC}"
else
    echo -e "${RED}❌ Error al reiniciar PM2${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📋 PASO 5: Mostrando logs de PM2${NC}"
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