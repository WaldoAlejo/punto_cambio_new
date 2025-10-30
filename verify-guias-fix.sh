#!/bin/bash

################################################################################
# Verification Script: Servientrega Guías Fix
# 
# Verifica que:
# 1. La migración SQL se aplicó
# 2. El servidor está corriendo
# 3. La BD tiene el campo usuario_id
#
# Uso: ./verify-guias-fix.sh
################################################################################

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🔍 Verificando Deploy: Servientrega Guías${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# ============================================================================
# 1. Verificar que PM2 está corriendo
# ============================================================================
echo -e "${YELLOW}1️⃣  Estado de PM2...${NC}"
echo ""

if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}❌ PM2 no está instalado${NC}"
    exit 1
fi

PM2_STATUS=$(pm2 list)
echo "$PM2_STATUS"
echo ""

# Buscar proceso activo
if echo "$PM2_STATUS" | grep -q "online"; then
    echo -e "${GREEN}✓ Al menos un proceso está online${NC}"
else
    echo -e "${RED}❌ Ningún proceso está online${NC}"
    exit 1
fi

# ============================================================================
# 2. Verificar que la BD tiene el campo usuario_id
# ============================================================================
echo ""
echo -e "${YELLOW}2️⃣  Verificando base de datos...${NC}"
echo ""

if [ ! -f ".env.production" ]; then
    echo -e "${RED}❌ .env.production no encontrado${NC}"
    exit 1
fi

export $(cat .env.production | grep -v '#' | xargs)

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL no está definida${NC}"
    exit 1
fi

# Verificar que el campo existe
COLUMN_CHECK=$(psql "$DATABASE_URL" -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='ServientregaGuia' AND column_name='usuario_id';" 2>/dev/null || echo "")

if [ -n "$COLUMN_CHECK" ]; then
    echo -e "${GREEN}✓ Campo usuario_id existe en ServientregaGuia${NC}"
else
    echo -e "${RED}❌ Campo usuario_id NO encontrado en ServientregaGuia${NC}"
    echo -e "${YELLOW}  Esto significa que la migración NO se aplicó correctamente${NC}"
    exit 1
fi

# ============================================================================
# 3. Verificar índices
# ============================================================================
echo ""
echo -e "${YELLOW}3️⃣  Verificando índices...${NC}"
echo ""

INDEX_CHECK=$(psql "$DATABASE_URL" -t -c "SELECT indexname FROM pg_indexes WHERE tablename='ServientregaGuia' AND indexname LIKE '%usuario%';" 2>/dev/null || echo "")

if [ -n "$INDEX_CHECK" ]; then
    echo -e "${GREEN}✓ Índices con usuario_id encontrados${NC}"
    echo "$INDEX_CHECK"
else
    echo -e "${YELLOW}⚠ No se encontraron índices con usuario_id${NC}"
    echo "  (No es crítico, pero ayuda al rendimiento)"
fi

# ============================================================================
# 4. Contar guías en la BD
# ============================================================================
echo ""
echo -e "${YELLOW}4️⃣  Estadísticas de guías...${NC}"
echo ""

TOTAL_GUIAS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM ServientregaGuia;" 2>/dev/null)
GUIAS_CON_USUARIO=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM ServientregaGuia WHERE usuario_id IS NOT NULL;" 2>/dev/null)

echo "Total de guías: $TOTAL_GUIAS"
echo "Guías con usuario_id: $GUIAS_CON_USUARIO"

if [ "$TOTAL_GUIAS" -gt 0 ]; then
    PORCENTAJE=$((GUIAS_CON_USUARIO * 100 / TOTAL_GUIAS))
    echo "Porcentaje: ${PORCENTAJE}%"
fi

# ============================================================================
# 5. Verificar logs del servidor
# ============================================================================
echo ""
echo -e "${YELLOW}5️⃣  Últimos errores en logs (últimas 20 líneas)...${NC}"
echo ""

PROCESS_NAME=$(pm2 list | grep -o "punto-cambio-api\|api" | head -1)

if [ -n "$PROCESS_NAME" ]; then
    echo "Revisar con: ${YELLOW}pm2 logs $PROCESS_NAME --lines 100${NC}"
    echo ""
    pm2 logs "$PROCESS_NAME" --err --lines 20 2>/dev/null || echo "No hay logs de error disponibles"
else
    echo -e "${YELLOW}⚠ No se pudo determinar el nombre del proceso${NC}"
fi

# ============================================================================
# Resumen Final
# ============================================================================
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Verificación completada${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "📋 Próximos pasos de testing:"
echo "   1. Accede a la aplicación web"
echo "   2. Genera una nueva guía de Servientrega"
echo "   3. Verifica que aparezca en 'Ver guías generadas'"
echo "   4. Verifica que el saldo se dedujo correctamente"
echo ""
echo -e "❓ Si hay problemas:"
echo "   - Ver logs: ${YELLOW}pm2 logs --lines 200${NC}"
echo "   - Reiniciar: ${YELLOW}pm2 restart all${NC}"
echo ""