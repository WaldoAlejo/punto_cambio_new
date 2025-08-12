#!/bin/bash

# Script de despliegue automatizado para Punto Cambio
# Uso: ./deploy.sh [quick|full]

set -e  # Salir si cualquier comando falla

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ✅ $1"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ⚠️  $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ❌ $1"
}

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ] || [ ! -f "ecosystem.config.js" ]; then
    error "Este script debe ejecutarse desde el directorio raíz del proyecto"
    exit 1
fi

# Determinar tipo de despliegue
DEPLOY_TYPE=${1:-"full"}

log "🚀 Iniciando despliegue tipo: $DEPLOY_TYPE"

# Crear directorio de logs si no existe
mkdir -p logs

# Función para despliegue completo
full_deploy() {
    log "📥 Haciendo pull del repositorio..."
    git pull origin main || {
        error "Error al hacer pull del repositorio"
        exit 1
    }
    
    log "📦 Instalando dependencias..."
    npm install || {
        error "Error al instalar dependencias"
        exit 1
    }
    
    log "🔧 Generando cliente Prisma..."
    npx prisma generate || {
        error "Error al generar cliente Prisma"
        exit 1
    }
    
    log "🗄️  Aplicando migraciones de base de datos..."
    npx prisma db push || {
        warning "Error al aplicar migraciones - continuando..."
    }
    
    log "🏗️  Construyendo aplicación..."
    npm run build || {
        error "Error al construir la aplicación"
        exit 1
    }
    
    success "Construcción completada exitosamente"
}

# Función para despliegue rápido
quick_deploy() {
    log "📥 Haciendo pull del repositorio..."
    git pull origin main || {
        error "Error al hacer pull del repositorio"
        exit 1
    }
    
    log "🏗️  Construyendo aplicación..."
    npm run build || {
        error "Error al construir la aplicación"
        exit 1
    }
    
    success "Construcción rápida completada"
}

# Ejecutar tipo de despliegue
case $DEPLOY_TYPE in
    "quick")
        quick_deploy
        ;;
    "full")
        full_deploy
        ;;
    *)
        error "Tipo de despliegue no válido. Use 'quick' o 'full'"
        exit 1
        ;;
esac

# Verificar si PM2 está corriendo
log "🔍 Verificando estado de PM2..."
if pm2 list | grep -q "punto-cambio-api"; then
    log "🔄 Reiniciando aplicación con PM2..."
    pm2 restart punto-cambio-api || {
        error "Error al reiniciar con PM2"
        exit 1
    }
else
    log "🚀 Iniciando aplicación con PM2..."
    pm2 start ecosystem.config.js --env production || {
        error "Error al iniciar con PM2"
        exit 1
    }
fi

# Verificar que la aplicación esté corriendo
log "⏳ Esperando que la aplicación inicie..."
sleep 5

# Health check
log "🏥 Verificando salud de la aplicación..."
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    success "✅ Aplicación desplegada exitosamente y funcionando"
    
    # Mostrar estado de PM2
    log "📊 Estado actual de PM2:"
    pm2 status
    
    # Mostrar logs recientes
    log "📝 Últimas líneas de log:"
    pm2 logs punto-cambio-api --lines 10 --nostream
    
else
    error "❌ La aplicación no responde al health check"
    log "📝 Mostrando logs de error:"
    pm2 logs punto-cambio-api --lines 20 --nostream
    exit 1
fi

success "🎉 Despliegue completado exitosamente!"
log "🌐 La aplicación está disponible en:"
log "   - Frontend: http://localhost:3001"
log "   - API: http://localhost:3001/api"
log "   - Health Check: http://localhost:3001/health"
log ""
log "📋 Comandos útiles:"
log "   - Ver logs: pm2 logs punto-cambio-api"
log "   - Ver estado: pm2 status"
log "   - Reiniciar: pm2 restart punto-cambio-api"
log "   - Parar: pm2 stop punto-cambio-api"