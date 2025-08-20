#!/bin/bash

# Script para actualizar la base de datos en la nueva VM
# IP de la nueva VM: 34.70.184.11

set -e

echo "🚀 Iniciando actualización de base de datos para nueva VM..."
echo "📍 Nueva IP: 34.70.184.11"

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

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ] || [ ! -d "prisma" ]; then
    log_error "Este script debe ejecutarse desde el directorio raíz del proyecto"
    exit 1
fi

# 1. Verificar conexión a la base de datos
log_info "Verificando conexión a la base de datos..."
if npx prisma db pull --preview-feature 2>/dev/null; then
    log_success "Conexión a la base de datos exitosa"
else
    log_error "No se puede conectar a la base de datos. Verifica la configuración."
    exit 1
fi

# 2. Generar el cliente de Prisma
log_info "Generando cliente de Prisma..."
npx prisma generate
log_success "Cliente de Prisma generado"

# 3. Aplicar migraciones pendientes
log_info "Aplicando migraciones de base de datos..."
npx prisma migrate deploy
log_success "Migraciones aplicadas"

# 4. Verificar el estado de la base de datos
log_info "Verificando estado de la base de datos..."
npx prisma migrate status
log_success "Estado de migraciones verificado"

# 5. Ejecutar seed si es necesario
log_warning "¿Deseas ejecutar el seed de datos iniciales? (y/N)"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    log_info "Ejecutando seed de datos..."
    npx prisma db seed
    log_success "Seed ejecutado correctamente"
else
    log_info "Seed omitido"
fi

# 6. Construir la aplicación
log_info "Construyendo la aplicación..."
npm run build
log_success "Aplicación construida"

# 7. Mostrar información de la nueva configuración
echo ""
log_success "🎉 Actualización completada exitosamente!"
echo ""
echo "📋 Configuración actualizada:"
echo "   • Nueva IP del servidor: 34.70.184.11:3001"
echo "   • URL de la API: http://34.70.184.11:3001/api"
echo "   • Base de datos actualizada con el schema de Prisma"
echo ""
echo "🔧 Próximos pasos en tu VM (34.70.184.11):"
echo "   1. Subir los archivos actualizados a la VM"
echo "   2. Ejecutar: npm install"
echo "   3. Ejecutar: npx prisma generate"
echo "   4. Reiniciar PM2: pm2 restart all"
echo ""
echo "🌐 URLs de acceso:"
echo "   • Aplicación: http://34.70.184.11:3001"
echo "   • API: http://34.70.184.11:3001/api"
echo "   • Health Check: http://34.70.184.11:3001/health"
echo ""
log_warning "Recuerda verificar que el puerto 3001 esté abierto en tu VM"