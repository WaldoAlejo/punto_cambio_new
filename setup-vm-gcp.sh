#!/bin/bash

# Script para configurar aplicación en VM GCP
# VM IP: 34.70.184.11
# Base de datos SQL Cloud: 34.66.51.85

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

echo "🚀 Configurando aplicación en VM GCP"
echo "📍 VM: 34.70.184.11"
echo "🗄️ Base de datos SQL Cloud: 34.66.51.85"
echo ""

# 1. Verificar conexión a la base de datos SQL Cloud
log_info "Verificando conexión a base de datos SQL Cloud..."
if npx prisma db pull --preview-feature 2>/dev/null; then
    log_success "Conexión a SQL Cloud exitosa"
else
    log_warning "Verificando conectividad a la base de datos..."
    # Intentar conexión básica
    if timeout 10 bash -c "</dev/tcp/34.66.51.85/5432" 2>/dev/null; then
        log_success "Puerto 5432 accesible en SQL Cloud"
    else
        log_error "No se puede conectar a SQL Cloud. Verifica:"
        echo "   • Permisos de red en SQL Cloud"
        echo "   • IP de la VM autorizada: 34.70.184.11"
        echo "   • Firewall de la VM"
        exit 1
    fi
fi

# 2. Instalar dependencias
log_info "Instalando dependencias..."
npm install
log_success "Dependencias instaladas"

# 3. Construir la aplicación
log_info "Construyendo aplicación..."
npm run build
log_success "Aplicación construida"

# 4. Generar cliente Prisma
log_info "Generando cliente Prisma..."
npx prisma generate
log_success "Cliente Prisma generado"

# 5. Verificar y aplicar migraciones
log_info "Verificando estado de migraciones..."
npx prisma migrate status

log_info "Aplicando migraciones pendientes..."
npx prisma migrate deploy
log_success "Migraciones aplicadas a SQL Cloud"

# 6. Verificar schema de la base de datos
log_info "Verificando schema de la base de datos..."
npx prisma db pull --preview-feature
log_success "Schema verificado"

# 7. Crear directorios necesarios
log_info "Creando directorios de logs..."
mkdir -p logs
log_success "Directorios creados"

# 8. Configurar PM2
log_info "Configurando PM2..."

# Detener procesos existentes
pm2 delete all || true

# Iniciar aplicación
pm2 start ecosystem.config.js

# Guardar configuración
pm2 save

# Configurar inicio automático
pm2 startup || log_warning "Ejecuta 'sudo pm2 startup' manualmente si es necesario"

log_success "PM2 configurado"

# 9. Verificar estado de la aplicación
log_info "Verificando estado de la aplicación..."
sleep 5

pm2 status
pm2 logs --lines 10

# 10. Verificar conectividad
log_info "Verificando conectividad..."

# Test interno
if curl -s --connect-timeout 5 http://localhost:3001/health > /dev/null; then
    log_success "Servidor responde localmente"
else
    log_warning "Servidor no responde localmente, verificando logs..."
    pm2 logs --lines 20
fi

# Test externo
if curl -s --connect-timeout 5 http://34.70.184.11:3001/health > /dev/null; then
    log_success "Servidor accesible externamente"
else
    log_warning "Servidor no accesible externamente. Verifica firewall."
fi

echo ""
log_success "🎉 Configuración completada!"
echo ""
echo "📊 Estado actual:"
pm2 status

echo ""
echo "🌐 URLs de acceso:"
echo "   • Aplicación: http://34.70.184.11:3001"
echo "   • API: http://34.70.184.11:3001/api"
echo "   • Health Check: http://34.70.184.11:3001/health"
echo ""
echo "🔧 Comandos útiles:"
echo "   • Ver logs: pm2 logs"
echo "   • Reiniciar: pm2 restart all"
echo "   • Estado: pm2 status"
echo "   • Monitoreo: pm2 monit"
echo ""
echo "🗄️ Base de datos:"
echo "   • SQL Cloud IP: 34.66.51.85"
echo "   • Estado migraciones: npx prisma migrate status"
echo ""

log_info "Si hay problemas, verifica:"
echo "   • Firewall GCP para puerto 3001"
echo "   • Permisos de red SQL Cloud"
echo "   • Variables de entorno en PM2: pm2 env 0"