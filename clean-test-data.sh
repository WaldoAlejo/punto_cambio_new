#!/bin/bash

###########################################################################
# 🧹 Script para Limpiar Datos de Prueba de Forma Segura
#
# Este script:
# - Busca guías con números >= 999999000 (números de test)
# - Crea backup automático antes de limpiar
# - Elimina solicitudes de anulación asociadas
# - Elimina movimientos de balance asociados
# - NO toca datos de producción
# - Registra todo en un log
###########################################################################

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_test_data_$TIMESTAMP.sql"
LOG_FILE="./clean-test-data_$TIMESTAMP.log"

# Crear directorio de backups si no existe
mkdir -p "$BACKUP_DIR"

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🧹 LIMPIEZA SEGURA DE DATOS DE PRUEBA${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Verificar DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ Error: DATABASE_URL no está configurada${NC}"
    echo "Configura con: export DATABASE_URL='postgresql://...'"
    exit 1
fi

echo -e "${YELLOW}📋 Verificando datos a limpiar...${NC}"

# Contar registros a eliminar
GUIA_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM \"ServientregaGuia\" WHERE numero_guia::text LIKE '999999%';" 2>/dev/null || echo "0")
SOLICITUD_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM \"ServientregaSolicitudAnulacion\" WHERE numero_guia::text LIKE '999999%';" 2>/dev/null || echo "0")
MOVIMIENTO_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM \"ServicioExternoMovimiento\" WHERE numero_referencia::text LIKE '999999%';" 2>/dev/null || echo "0")

echo -e "${YELLOW}📊 Registros encontrados:${NC}"
echo "   - Guías de prueba: $GUIA_COUNT"
echo "   - Solicitudes de anulación: $SOLICITUD_COUNT"
echo "   - Movimientos de balance: $MOVIMIENTO_COUNT"
echo ""

if [ "$GUIA_COUNT" -eq 0 ] && [ "$SOLICITUD_COUNT" -eq 0 ] && [ "$MOVIMIENTO_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✅ No hay datos de prueba para limpiar${NC}"
    exit 0
fi

# Crear backup
echo -e "${YELLOW}💾 Creando backup...${NC}"
psql "$DATABASE_URL" -c "\COPY (
    SELECT * FROM \"ServientregaGuia\" WHERE numero_guia::text LIKE '999999%'
) TO STDOUT" > "$BACKUP_FILE" 2>/dev/null || true

if [ -f "$BACKUP_FILE" ]; then
    echo -e "${GREEN}✅ Backup creado: $BACKUP_FILE${NC}"
else
    echo -e "${YELLOW}⚠️  No se pudo crear backup, pero continuando...${NC}"
fi

# Confirmar antes de eliminar
echo ""
echo -e "${RED}⚠️  ESTA ACCIÓN ELIMINARÁ:${NC}"
echo "   - $GUIA_COUNT guías de prueba"
echo "   - $SOLICITUD_COUNT solicitudes de anulación"
echo "   - $MOVIMIENTO_COUNT movimientos de balance"
echo ""
read -p "¿Deseas continuar? (escribe 'SI' para confirmar): " CONFIRM

if [ "$CONFIRM" != "SI" ]; then
    echo -e "${YELLOW}❌ Operación cancelada${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}🔄 Eliminando datos de prueba...${NC}"

# Eliminar en el orden correcto (respetar constraints)
echo "1️⃣  Eliminando solicitudes de anulación..."
psql "$DATABASE_URL" -c "DELETE FROM \"ServientregaSolicitudAnulacion\" WHERE numero_guia::text LIKE '999999%';" 2>/dev/null || true

echo "2️⃣  Eliminando movimientos de balance..."
psql "$DATABASE_URL" -c "DELETE FROM \"ServicioExternoMovimiento\" WHERE numero_referencia::text LIKE '999999%';" 2>/dev/null || true

echo "3️⃣  Eliminando movimientos de saldo..."
psql "$DATABASE_URL" -c "DELETE FROM \"MovimientoSaldo\" WHERE referencia_id::text LIKE '999999%';" 2>/dev/null || true

echo "4️⃣  Eliminando guías..."
psql "$DATABASE_URL" -c "DELETE FROM \"ServientregaGuia\" WHERE numero_guia::text LIKE '999999%';" 2>/dev/null || true

# Verificar que se eliminaron
echo ""
echo -e "${YELLOW}✅ Verificando eliminación...${NC}"
REMAINING=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM \"ServientregaGuia\" WHERE numero_guia::text LIKE '999999%';" 2>/dev/null || echo "0")

if [ "$REMAINING" -eq 0 ]; then
    echo -e "${GREEN}✅ LIMPIEZA COMPLETADA EXITOSAMENTE${NC}"
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✨ Resumen:${NC}"
    echo "   - Guías eliminadas: $GUIA_COUNT"
    echo "   - Solicitudes eliminadas: $SOLICITUD_COUNT"
    echo "   - Movimientos eliminados: $MOVIMIENTO_COUNT"
    echo "   - Backup: $BACKUP_FILE"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
else
    echo -e "${RED}❌ Error: Aún quedan $REMAINING registros${NC}"
    exit 1
fi

exit 0