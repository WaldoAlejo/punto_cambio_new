#!/bin/bash

# Script para sincronizar archivos con la nueva VM
# Ajusta las variables según tu configuración

# Configuración de la VM
VM_IP="34.70.184.11"
VM_USER="tu_usuario"  # Cambia por tu usuario
VM_PATH="/home/$VM_USER/punto_cambio_new"  # Cambia por la ruta correcta

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

echo "🚀 Sincronizando archivos con VM: $VM_IP"
echo ""

# Verificar configuración
log_warning "IMPORTANTE: Antes de continuar, verifica estas configuraciones:"
echo "   • IP de la VM: $VM_IP"
echo "   • Usuario: $VM_USER"
echo "   • Ruta en VM: $VM_PATH"
echo ""
echo "¿Los datos son correctos? (y/N)"
read -r response
if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    log_info "Edita este script y ajusta las variables VM_USER y VM_PATH"
    exit 0
fi

# Crear lista de archivos a sincronizar
log_info "Preparando archivos para sincronización..."

# Archivos críticos que deben sincronizarse
CRITICAL_FILES=(
    ".env.production"
    "ecosystem.config.js"
    "vm-setup-commands.sh"
    "package.json"
    "package-lock.json"
    "tsconfig.json"
    "tsconfig.server.json"
    "prisma/"
    "server/"
    "src/"
    "public/"
    "index.html"
    "vite.config.ts"
    "tailwind.config.ts"
    "postcss.config.js"
    "components.json"
)

# Método 1: Usando rsync (recomendado)
log_info "Método 1: Sincronización con rsync"
echo "Comando sugerido:"
echo "rsync -avz --progress --exclude 'node_modules' --exclude 'dist' --exclude '.git' --exclude 'logs' . $VM_USER@$VM_IP:$VM_PATH/"
echo ""

# Método 2: Usando scp
log_info "Método 2: Copia con scp"
echo "Comandos sugeridos:"
for file in "${CRITICAL_FILES[@]}"; do
    echo "scp -r $file $VM_USER@$VM_IP:$VM_PATH/"
done
echo ""

# Método 3: Crear archivo tar
log_info "Método 3: Crear archivo comprimido"
echo "Creando archivo punto_cambio_updated.tar.gz..."

tar -czf punto_cambio_updated.tar.gz \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='.git' \
    --exclude='logs' \
    --exclude='*.log' \
    .

if [ -f "punto_cambio_updated.tar.gz" ]; then
    log_success "Archivo comprimido creado: punto_cambio_updated.tar.gz"
    echo "Sube este archivo a tu VM y descomprímelo:"
    echo "scp punto_cambio_updated.tar.gz $VM_USER@$VM_IP:~/"
    echo "ssh $VM_USER@$VM_IP 'tar -xzf punto_cambio_updated.tar.gz'"
else
    log_error "Error al crear archivo comprimido"
fi

echo ""
log_info "Comandos para ejecutar en la VM después de subir archivos:"
echo "1. ssh $VM_USER@$VM_IP"
echo "2. cd $VM_PATH"
echo "3. chmod +x vm-setup-commands.sh"
echo "4. ./vm-setup-commands.sh"
echo ""

log_warning "Recuerda verificar:"
echo "   • Conexión SSH a la VM"
echo "   • Permisos de escritura en la ruta destino"
echo "   • Puerto 3001 abierto en firewall"
echo "   • PM2 instalado en la VM"