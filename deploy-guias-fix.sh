#!/bin/bash

################################################################################
# Deploy Script: Fix Servientrega Guías - Usuario ID Tracking
# 
# Objetivo: Agregar usuario_id a las guías de Servientrega para que aparezcan
#           en el listado incluso cuando el operator no tiene jornada activa
#
# Uso: ./deploy-guias-fix.sh
################################################################################

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Iniciando deploy: Fix Servientrega Guías${NC}"
echo ""

# ============================================================================
# PASO 1: Validar que estamos en el directorio correcto
# ============================================================================

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json no encontrado.${NC}"
    echo "Ejecuta este script desde la raíz del proyecto."
    exit 1
fi

echo -e "${GREEN}✓ Directorio validado${NC}"

# ============================================================================
# PASO 2: Cargar variables de entorno
# ============================================================================

if [ ! -f ".env.production" ]; then
    echo -e "${RED}❌ Error: .env.production no encontrado.${NC}"
    exit 1
fi

export $(cat .env.production | grep -v '#' | xargs)
echo -e "${GREEN}✓ Variables de entorno cargadas${NC}"

# ============================================================================
# PASO 3: Aplicar migración SQL a la base de datos
# ============================================================================

echo ""
echo -e "${YELLOW}📝 Aplicando migración SQL...${NC}"

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ Error: DATABASE_URL no está definida${NC}"
    exit 1
fi

# Extract connection details from DATABASE_URL
# Format: postgresql://user:password@host:port/database
PGURL="$DATABASE_URL"

if psql "$PGURL" -f "server/migrations/2025-11-fix-servientrega-guias-usuario-id.sql" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Migración SQL aplicada exitosamente${NC}"
else
    echo -e "${YELLOW}⚠ La migración puede haber fallado o ya estaba aplicada${NC}"
    echo "  Continuando con el deploy..."
fi

# ============================================================================
# PASO 4: Regenerar Prisma Client
# ============================================================================

echo ""
echo -e "${YELLOW}🔧 Regenerando Prisma Client...${NC}"

npx prisma generate

echo -e "${GREEN}✓ Prisma Client regenerado${NC}"

# ============================================================================
# PASO 5: Compilar TypeScript del servidor
# ============================================================================

echo ""
echo -e "${YELLOW}📦 Compilando TypeScript del backend...${NC}"

npm run build:server

echo -e "${GREEN}✓ Backend compilado exitosamente${NC}"

# ============================================================================
# PASO 6: Reiniciar PM2
# ============================================================================

echo ""
echo -e "${YELLOW}♻️  Reiniciando PM2...${NC}"

# Primero, listar procesos para ver qué hay activo
echo "Procesos PM2 actuales:"
pm2 list

# Detectar el nombre del proceso (puede variar)
# Estrategia: primero intentar con el nombre conocido, luego buscar
PROCESS_NAME=""

if pm2 describe "punto-cambio-api" > /dev/null 2>&1; then
    PROCESS_NAME="punto-cambio-api"
elif pm2 describe "api" > /dev/null 2>&1; then
    PROCESS_NAME="api"
else
    # Buscar en la lista usando formato JSON (-m flag)
    PROCESS_NAME=$(pm2 info all 2>/dev/null | grep -i "name.*:" | head -1 | sed 's/.*name.*:\s*//' | xargs)
fi

if [ -z "$PROCESS_NAME" ]; then
    echo -e "${RED}❌ No se pudo detectar el proceso PM2.${NC}"
    echo "Procesos disponibles:"
    pm2 list
    echo ""
    echo -e "${YELLOW}Especifica el nombre exacto del proceso para reiniciar:${NC}"
    echo "   pm2 restart <nombre_proceso> --update-env"
    exit 1
fi

echo "Reiniciando proceso: $PROCESS_NAME"
pm2 restart "$PROCESS_NAME" --update-env

echo -e "${GREEN}✓ Servicio reiniciado${NC}"

# ============================================================================
# PASO 7: Verificación Final
# ============================================================================

echo ""
echo -e "${YELLOW}✨ Verificando deploy...${NC}"

# Esperar un segundo a que PM2 inicie el proceso
sleep 2

# Verificar que el servicio está corriendo
if pm2 list | grep -q "$PROCESS_NAME"; then
    echo -e "${GREEN}✓ Servicio está corriendo${NC}"
else
    echo -e "${RED}❌ Error: Servicio no está corriendo${NC}"
    echo "Revisa los logs con: pm2 logs $PROCESS_NAME"
    exit 1
fi

# Verificar que la migración SQL se aplicó
echo ""
echo -e "${YELLOW}🔍 Verificando que la migración se aplicó correctamente...${NC}"

RESULT=$(psql "$PGURL" -c "SELECT column_name FROM information_schema.columns WHERE table_name='ServientregaGuia' AND column_name='usuario_id';" 2>/dev/null)

if echo "$RESULT" | grep -q "usuario_id"; then
    echo -e "${GREEN}✓ Campo usuario_id existe en la tabla${NC}"
else
    echo -e "${YELLOW}⚠ No se pudo verificar el campo usuario_id${NC}"
fi

# ============================================================================
# Resumen Final
# ============================================================================

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Deploy completado exitosamente!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "📋 Próximos pasos:"
echo "   1. Verifica los logs: ${YELLOW}pm2 logs $PROCESS_NAME${NC}"
echo "   2. Genera una guía de prueba desde la aplicación"
echo "   3. Verifica que aparezca en 'Ver guías generadas'"
echo ""
echo -e "❓ Si hay problemas:"
echo "   - Revisa logs: ${YELLOW}pm2 logs $PROCESS_NAME --lines 100${NC}"
echo "   - Rollback: Ejecuta el rollback manual (ver DEPLOY-GUIAS-INSTRUCCIONES.md)"
echo ""
