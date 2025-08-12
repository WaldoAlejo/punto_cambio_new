#!/bin/bash

# Script final para verificar que todo está listo para despliegue

set -e

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[READY]${NC} $1"
}

success() {
    echo -e "${GREEN}[OK]${NC} ✅ $1"
}

warning() {
    echo -e "${YELLOW}[INFO]${NC} ℹ️  $1"
}

echo "🚀 Verificando que todo está listo para despliegue..."
echo ""

# Verificar archivos críticos
log "Verificando archivos críticos..."

files=(
    "package.json"
    "ecosystem.config.js"
    ".env.production"
    "server/index.ts"
    "src/main.tsx"
    "prisma/schema.prisma"
    "deploy.sh"
    "vite.config.ts"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        success "$file ✓"
    else
        warning "$file no encontrado"
    fi
done

echo ""
log "Verificando scripts de despliegue..."

scripts=(
    "deploy.sh"
    "start.sh"
    "check-system.sh"
    "test-build.sh"
)

for script in "${scripts[@]}"; do
    if [ -f "$script" ] && [ -x "$script" ]; then
        success "$script es ejecutable ✓"
    else
        warning "$script no es ejecutable o no existe"
    fi
done

echo ""
log "Verificando configuración de package.json..."

# Verificar scripts importantes en package.json
if grep -q '"build":' package.json; then
    success "Script 'build' configurado ✓"
fi

if grep -q '"build:frontend":' package.json; then
    success "Script 'build:frontend' configurado ✓"
fi

if grep -q '"build:server":' package.json; then
    success "Script 'build:server' configurado ✓"
fi

if grep -q '"deploy":' package.json; then
    success "Script 'deploy' configurado ✓"
fi

echo ""
log "Verificando configuración del servidor..."

if grep -q "express.static" server/index.ts; then
    success "Servidor configurado para servir archivos estáticos ✓"
fi

if grep -q "NODE_ENV.*production" server/index.ts; then
    success "Configuración de producción detectada ✓"
fi

echo ""
log "Verificando configuración de PM2..."

if grep -q "punto-cambio-api" ecosystem.config.js; then
    success "Nombre de aplicación PM2 configurado ✓"
fi

if grep -q "env_production" ecosystem.config.js; then
    success "Configuración de producción PM2 ✓"
fi

echo ""
success "🎉 ¡Todo está listo para despliegue!"
echo ""
warning "📋 Próximos pasos en tu VM de GCP:"
echo "   1. git clone <tu-repositorio> (primera vez)"
echo "   2. cd punto_cambio_new"
echo "   3. npm install (primera vez)"
echo "   4. ./deploy.sh full (primera vez)"
echo "   5. Para actualizaciones: ./deploy.sh quick"
echo ""
warning "🌐 Tu aplicación estará disponible en:"
echo "   http://35.238.95.118:3001"
echo ""
warning "📚 Documentación disponible:"
echo "   - DESPLIEGUE-SIMPLE.md (guía rápida)"
echo "   - SETUP-PRODUCTION.md (guía completa)"
echo "   - DEPLOYMENT.md (documentación técnica)"