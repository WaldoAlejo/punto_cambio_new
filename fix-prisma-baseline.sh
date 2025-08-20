#!/bin/bash

# Script para hacer baseline de la base de datos existente con Prisma Migrate

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🔧 Configurando Prisma Migrate para base de datos existente"
echo "🗄️ Base de datos SQL Cloud: 34.66.51.85"
echo ""

# 1. Verificar conexión a la base de datos
log_info "Verificando conexión a la base de datos..."
if npx prisma db pull --preview-feature 2>/dev/null; then
    log_success "Conexión exitosa a SQL Cloud"
else
    log_error "No se puede conectar a la base de datos"
    exit 1
fi

# 2. Sincronizar schema con la base de datos existente
log_info "Sincronizando schema de Prisma con la base de datos existente..."
npx prisma db pull
log_success "Schema sincronizado"

# 3. Generar cliente actualizado
log_info "Generando cliente Prisma actualizado..."
npx prisma generate
log_success "Cliente Prisma generado"

# 4. Crear migración inicial (baseline)
log_info "Creando migración baseline para base de datos existente..."
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql

# Crear directorio de migración si no existe
mkdir -p prisma/migrations/0_init

# Crear migración baseline
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql

log_success "Migración baseline creada"

# 5. Marcar la migración como aplicada (sin ejecutarla)
log_info "Marcando migración baseline como aplicada..."
npx prisma migrate resolve --applied 0_init
log_success "Migración baseline marcada como aplicada"

# 6. Verificar estado de migraciones
log_info "Verificando estado final de migraciones..."
npx prisma migrate status
log_success "Estado de migraciones verificado"

# 7. Aplicar cualquier migración pendiente
log_info "Aplicando migraciones pendientes (si las hay)..."
npx prisma migrate deploy
log_success "Migraciones aplicadas"

echo ""
log_success "🎉 Prisma Migrate configurado correctamente!"
echo ""
echo "📊 Resumen:"
echo "   • Base de datos existente reconocida"
echo "   • Schema sincronizado"
echo "   • Migración baseline creada y marcada como aplicada"
echo "   • Sistema listo para futuras migraciones"
echo ""
echo "🔧 Comandos útiles:"
echo "   • Ver estado: npx prisma migrate status"
echo "   • Aplicar migraciones: npx prisma migrate deploy"
echo "   • Crear nueva migración: npx prisma migrate dev --name nombre_migracion"