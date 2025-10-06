#!/bin/bash

# ============================================================================
# SCRIPT DE CONSOLIDACIÓN FINAL
# Automatiza la implementación definitiva de la solución de egresos positivos
# ============================================================================

set -e  # Salir si hay algún error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir con color
print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

# Banner
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║        🎯 CONSOLIDACIÓN FINAL - SOLUCIÓN DEFINITIVA           ║"
echo "║           Eliminación de Parches Temporales                   ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    print_error "Este script debe ejecutarse desde la raíz del proyecto"
    exit 1
fi

print_success "Directorio correcto verificado"

# ============================================================================
# FASE 1: VERIFICACIÓN PRE-CONSOLIDACIÓN
# ============================================================================
echo ""
print_step "FASE 1: Verificación Pre-Consolidación"
echo ""

# Verificar que los archivos de la solución existen
print_step "Verificando archivos de la solución..."

if [ ! -f "server/services/movimientoSaldoService.ts" ]; then
    print_error "Falta: server/services/movimientoSaldoService.ts"
    exit 1
fi
print_success "Servicio centralizado encontrado"

if [ ! -f "server/migrations/2025-01-28-add-movimiento-saldo-constraints.sql" ]; then
    print_error "Falta: server/migrations/2025-01-28-add-movimiento-saldo-constraints.sql"
    exit 1
fi
print_success "Migración SQL encontrada"

if [ ! -f "server/scripts/validar-implementacion.ts" ]; then
    print_error "Falta: server/scripts/validar-implementacion.ts"
    exit 1
fi
print_success "Script de validación encontrado"

# ============================================================================
# FASE 2: BACKUP
# ============================================================================
echo ""
print_step "FASE 2: Creando Backup"
echo ""

print_warning "IMPORTANTE: Asegúrate de tener un backup de tu base de datos"
read -p "¿Ya tienes un backup de la base de datos? (s/n): " backup_confirm

if [ "$backup_confirm" != "s" ] && [ "$backup_confirm" != "S" ]; then
    print_error "Por favor, crea un backup antes de continuar"
    echo ""
    echo "Comando sugerido:"
    echo "pg_dump -h localhost -U tu_usuario -d punto_cambio > backup_\$(date +%Y%m%d_%H%M%S).sql"
    exit 1
fi

print_success "Backup confirmado"

# ============================================================================
# FASE 3: COMPILACIÓN
# ============================================================================
echo ""
print_step "FASE 3: Compilando TypeScript"
echo ""

print_step "Compilando servidor..."
if npm run build:server; then
    print_success "Compilación exitosa"
else
    print_error "Error en la compilación"
    print_warning "Revisa los errores de TypeScript antes de continuar"
    exit 1
fi

# ============================================================================
# FASE 4: VALIDACIÓN DE CÓDIGO
# ============================================================================
echo ""
print_step "FASE 4: Validando Implementación"
echo ""

print_step "Ejecutando script de validación..."
if npx tsx server/scripts/validar-implementacion.ts; then
    print_success "Validación exitosa"
else
    print_error "La validación falló"
    print_warning "Revisa los errores antes de continuar"
    exit 1
fi

# ============================================================================
# FASE 5: MIGRACIÓN SQL
# ============================================================================
echo ""
print_step "FASE 5: Aplicando Migración SQL"
echo ""

print_warning "Esta fase aplicará constraints a la base de datos"
read -p "¿Deseas aplicar la migración SQL ahora? (s/n): " migrate_confirm

if [ "$migrate_confirm" = "s" ] || [ "$migrate_confirm" = "S" ]; then
    print_step "Aplicando migración..."
    
    # Aquí deberías agregar el comando específico para tu base de datos
    print_warning "Ejecuta manualmente:"
    echo ""
    echo "psql -h localhost -U tu_usuario -d punto_cambio -f server/migrations/2025-01-28-add-movimiento-saldo-constraints.sql"
    echo ""
    read -p "Presiona ENTER cuando hayas aplicado la migración..."
    
    print_success "Migración aplicada"
else
    print_warning "Migración SQL pendiente - Debes aplicarla manualmente"
fi

# ============================================================================
# FASE 6: DEPRECAR SCRIPTS TEMPORALES
# ============================================================================
echo ""
print_step "FASE 6: Moviendo Scripts Temporales a DEPRECATED"
echo ""

DEPRECATED_DIR="server/scripts/DEPRECATED_$(date +%Y%m%d)"
mkdir -p "$DEPRECATED_DIR"

# Lista de scripts temporales a deprecar
TEMP_SCRIPTS=(
    "server/scripts/corregir-egresos-positivos.ts"
    "server/scripts/corregir-saldo-inicial-cotocollao.ts"
)

for script in "${TEMP_SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        mv "$script" "$DEPRECATED_DIR/"
        print_success "Movido: $(basename $script)"
    else
        print_warning "No encontrado: $(basename $script)"
    fi
done

# Crear README en carpeta DEPRECATED
cat > "$DEPRECATED_DIR/README.md" << 'EOF'
# Scripts Deprecados

Estos scripts fueron utilizados para correcciones temporales del bug de egresos positivos.

**Fecha de deprecación**: $(date +%Y-%m-%d)

## ¿Por qué fueron deprecados?

Se implementó una solución definitiva que incluye:
1. Servicio centralizado (`movimientoSaldoService.ts`)
2. Constraints de base de datos
3. Refactorización de código existente

Estos scripts ya NO son necesarios y NO deben usarse.

## Solución Definitiva

Ver documentación en:
- `LEEME_PRIMERO.md`
- `SOLUCION_DEFINITIVA_EGRESOS.md`
- `PLAN_CONSOLIDACION_FINAL.md`

## Regla de Oro

⚠️  NUNCA registres movimientos directamente en movimiento_saldo
⚠️  SIEMPRE usa registrarMovimientoSaldo()
EOF

print_success "Scripts temporales movidos a: $DEPRECATED_DIR"

# ============================================================================
# FASE 7: RESUMEN Y PRÓXIMOS PASOS
# ============================================================================
echo ""
print_step "FASE 7: Resumen de Consolidación"
echo ""

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    ✅ CONSOLIDACIÓN COMPLETA                   ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

print_success "Servicio centralizado: Implementado"
print_success "Compilación TypeScript: Exitosa"
print_success "Validación de código: Pasada"
print_success "Scripts temporales: Deprecados"

echo ""
print_step "PRÓXIMOS PASOS:"
echo ""
echo "1. Aplicar migración SQL (si no lo hiciste aún)"
echo "2. Reiniciar el servidor: pm2 reload punto-cambio-api"
echo "3. Ejecutar tests funcionales (ver PLAN_CONSOLIDACION_FINAL.md)"
echo "4. Verificar que no hay egresos positivos:"
echo ""
echo "   SELECT COUNT(*) FROM movimiento_saldo"
echo "   WHERE tipo_movimiento = 'EGRESO' AND monto >= 0;"
echo ""
echo "5. Hacer commit de los cambios"
echo ""

print_step "DOCUMENTACIÓN:"
echo ""
echo "📖 LEEME_PRIMERO.md                    - Punto de entrada"
echo "📖 INICIO_RAPIDO.md                    - Guía rápida (30 min)"
echo "📖 PLAN_CONSOLIDACION_FINAL.md         - Este plan detallado"
echo "📖 SOLUCION_DEFINITIVA_EGRESOS.md      - Documentación técnica"
echo ""

print_step "REGLA DE ORO:"
echo ""
echo "⚠️  NUNCA registres movimientos directamente en movimiento_saldo"
echo "⚠️  SIEMPRE usa registrarMovimientoSaldo()"
echo "⚠️  SIEMPRE pasa el monto POSITIVO (el servicio aplica el signo)"
echo ""

print_success "¡Consolidación completada exitosamente!"
echo ""