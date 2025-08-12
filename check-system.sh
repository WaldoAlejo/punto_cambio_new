#!/bin/bash

# Script de verificación del sistema
# Verifica que todo esté configurado correctamente para el despliegue

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[CHECK]${NC} $1"
}

success() {
    echo -e "${GREEN}[OK]${NC} ✅ $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} ⚠️  $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} ❌ $1"
}

ERRORS=0

log "🔍 Verificando configuración del sistema..."

# Verificar Node.js
log "Verificando Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    success "Node.js instalado: $NODE_VERSION"
else
    error "Node.js no está instalado"
    ((ERRORS++))
fi

# Verificar NPM
log "Verificando NPM..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    success "NPM instalado: $NPM_VERSION"
else
    error "NPM no está instalado"
    ((ERRORS++))
fi

# Verificar PM2
log "Verificando PM2..."
if command -v pm2 &> /dev/null; then
    PM2_VERSION=$(pm2 --version)
    success "PM2 instalado: $PM2_VERSION"
else
    warning "PM2 no está instalado globalmente"
    log "Instalar con: npm install -g pm2"
fi

# Verificar archivos de configuración
log "Verificando archivos de configuración..."

if [ -f "package.json" ]; then
    success "package.json encontrado"
else
    error "package.json no encontrado"
    ((ERRORS++))
fi

if [ -f "ecosystem.config.js" ]; then
    success "ecosystem.config.js encontrado"
else
    error "ecosystem.config.js no encontrado"
    ((ERRORS++))
fi

if [ -f ".env.production" ]; then
    success ".env.production encontrado"
else
    warning ".env.production no encontrado"
fi

if [ -f "prisma/schema.prisma" ]; then
    success "Esquema Prisma encontrado"
else
    error "Esquema Prisma no encontrado"
    ((ERRORS++))
fi

# Verificar estructura de directorios
log "Verificando estructura de directorios..."

if [ -d "src" ]; then
    success "Directorio src/ encontrado"
else
    error "Directorio src/ no encontrado"
    ((ERRORS++))
fi

if [ -d "server" ]; then
    success "Directorio server/ encontrado"
else
    error "Directorio server/ no encontrado"
    ((ERRORS++))
fi

if [ -d "prisma" ]; then
    success "Directorio prisma/ encontrado"
else
    error "Directorio prisma/ no encontrado"
    ((ERRORS++))
fi

# Crear directorio de logs si no existe
if [ ! -d "logs" ]; then
    log "Creando directorio logs/..."
    mkdir -p logs
    success "Directorio logs/ creado"
else
    success "Directorio logs/ encontrado"
fi

# Verificar dependencias
log "Verificando dependencias..."
if [ -d "node_modules" ]; then
    success "node_modules/ encontrado"
else
    warning "node_modules/ no encontrado - ejecutar 'npm install'"
fi

# Verificar si la aplicación está construida
log "Verificando construcción..."
if [ -d "dist" ]; then
    success "Directorio dist/ encontrado"
    
    if [ -f "dist/index.js" ]; then
        success "Backend construido (dist/index.js)"
    else
        warning "Backend no construido - ejecutar 'npm run build:server'"
    fi
    
    if [ -f "dist/index.html" ]; then
        success "Frontend construido (dist/index.html)"
    else
        warning "Frontend no construido - ejecutar 'npm run build:frontend'"
    fi
else
    warning "Directorio dist/ no encontrado - ejecutar 'npm run build'"
fi

# Verificar puertos
log "Verificando puertos..."
if lsof -i :3001 &> /dev/null; then
    warning "Puerto 3001 está en uso"
    lsof -i :3001
else
    success "Puerto 3001 disponible"
fi

# Verificar conexión a base de datos (si Prisma está disponible)
if command -v npx &> /dev/null && [ -f "prisma/schema.prisma" ]; then
    log "Verificando conexión a base de datos..."
    if npx prisma db push --preview-feature &> /dev/null; then
        success "Conexión a base de datos OK"
    else
        warning "No se pudo conectar a la base de datos"
    fi
fi

# Verificar scripts de despliegue
log "Verificando scripts de despliegue..."
if [ -f "deploy.sh" ] && [ -x "deploy.sh" ]; then
    success "Script deploy.sh encontrado y ejecutable"
else
    warning "Script deploy.sh no encontrado o no ejecutable"
fi

if [ -f "start.sh" ] && [ -x "start.sh" ]; then
    success "Script start.sh encontrado y ejecutable"
else
    warning "Script start.sh no encontrado o no ejecutable"
fi

# Resumen
echo ""
log "📊 Resumen de verificación:"

if [ $ERRORS -eq 0 ]; then
    success "🎉 Sistema listo para despliegue!"
    echo ""
    log "Próximos pasos:"
    log "1. Si es la primera vez: npm install"
    log "2. Construir aplicación: npm run build"
    log "3. Desplegar: ./deploy.sh full"
else
    error "❌ Se encontraron $ERRORS errores críticos"
    log "Por favor, corrige los errores antes de continuar"
    exit 1
fi