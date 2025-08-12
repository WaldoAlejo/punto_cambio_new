#!/bin/bash

# Script de inicio rápido para desarrollo y producción
# Uso: ./start.sh [dev|prod]

set -e

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ✅ $1"
}

MODE=${1:-"prod"}

case $MODE in
    "dev")
        log "🚀 Iniciando en modo desarrollo..."
        log "Frontend: http://localhost:5173"
        log "Backend: http://localhost:3001"
        
        # Iniciar backend en background
        npm run dev:server &
        BACKEND_PID=$!
        
        # Esperar un poco para que el backend inicie
        sleep 3
        
        # Iniciar frontend
        npm run dev
        
        # Cleanup cuando se termine el script
        trap "kill $BACKEND_PID" EXIT
        ;;
        
    "prod")
        log "🚀 Iniciando en modo producción con PM2..."
        
        # Verificar que esté construido
        if [ ! -d "dist" ]; then
            log "📦 Construyendo aplicación..."
            npm run build
        fi
        
        # Iniciar con PM2
        pm2 start ecosystem.config.js --env production
        
        success "✅ Aplicación iniciada en producción"
        log "🌐 Disponible en: http://localhost:3001"
        log "📊 Ver estado: pm2 status"
        log "📝 Ver logs: pm2 logs punto-cambio-api"
        ;;
        
    *)
        echo "Uso: ./start.sh [dev|prod]"
        echo "  dev  - Modo desarrollo (frontend y backend separados)"
        echo "  prod - Modo producción (todo en puerto 3001 con PM2)"
        exit 1
        ;;
esac