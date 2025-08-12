#!/bin/bash

# Script para probar la construcción local antes del despliegue

set -e

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

success() {
    echo -e "${GREEN}[OK]${NC} ✅ $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} ❌ $1"
}

log "🧪 Probando construcción local..."

# Limpiar dist anterior
if [ -d "dist" ]; then
    log "🧹 Limpiando construcción anterior..."
    rm -rf dist
fi

# Construir frontend
log "🏗️  Construyendo frontend..."
if npm run build:frontend; then
    success "Frontend construido exitosamente"
else
    error "Error al construir frontend"
    exit 1
fi

# Verificar archivos del frontend
if [ -f "dist/index.html" ]; then
    success "index.html generado"
else
    error "index.html no encontrado"
    exit 1
fi

# Construir backend
log "🏗️  Construyendo backend..."
if npm run build:server; then
    success "Backend construido exitosamente"
else
    error "Error al construir backend"
    exit 1
fi

# Verificar archivos del backend
if [ -f "dist/index.js" ]; then
    success "Backend JavaScript generado"
else
    error "Backend JavaScript no encontrado"
    exit 1
fi

# Mostrar estructura de dist
log "📁 Estructura del directorio dist:"
ls -la dist/

# Verificar tamaño de archivos
log "📊 Tamaños de archivos principales:"
if [ -f "dist/index.html" ]; then
    echo "  index.html: $(du -h dist/index.html | cut -f1)"
fi
if [ -f "dist/index.js" ]; then
    echo "  index.js: $(du -h dist/index.js | cut -f1)"
fi

# Contar archivos estáticos
STATIC_FILES=$(find dist -name "*.js" -o -name "*.css" -o -name "*.html" | wc -l)
log "📦 Total de archivos estáticos: $STATIC_FILES"

success "🎉 Construcción completada exitosamente!"
log "✨ El proyecto está listo para despliegue"