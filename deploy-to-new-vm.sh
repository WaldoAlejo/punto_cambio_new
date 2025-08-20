#!/bin/bash

# Script para desplegar en la nueva VM
# IP: 34.70.184.11

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

echo "🚀 Preparando despliegue para nueva VM: 34.70.184.11"
echo ""

# 1. Verificar que todos los archivos están actualizados
log_info "Verificando configuración actualizada..."

# Verificar que las IPs han sido actualizadas
if grep -q "34.70.184.11" .env.production; then
    log_success "Archivo .env.production actualizado"
else
    log_error "El archivo .env.production no tiene la nueva IP"
    exit 1
fi

if grep -q "34.70.184.11" server/index.ts; then
    log_success "Archivo server/index.ts actualizado"
else
    log_error "El archivo server/index.ts no tiene la nueva IP en CORS"
    exit 1
fi

# 2. Construir la aplicación
log_info "Construyendo aplicación..."
npm run build
log_success "Aplicación construida exitosamente"

# 3. Crear archivo de configuración PM2 actualizado
log_info "Creando configuración PM2 actualizada..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'punto-cambio-server',
      script: './dist/index.js',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DATABASE_URL: 'postgresql://postgres:Esh2ew8p@34.66.51.85:5432/punto_cambio',
        JWT_SECRET: 's3rv13ntr3g4_super_secure_jwt_key_change_in_production',
        FRONTEND_URL: 'http://34.70.184.11:3001',
        VITE_API_URL: 'http://34.70.184.11:3001/api',
        LOG_LEVEL: 'info',
        RATE_LIMIT_WINDOW_MS: 900000,
        RATE_LIMIT_MAX_REQUESTS: 100,
        LOGIN_RATE_LIMIT_MAX_REQUESTS: 5
      },
      error_file: './logs/error.log',
      out_file: './logs/combined.log',
      log_file: './logs/combined.log',
      time: true,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024'
    }
  ]
};
EOF
log_success "Configuración PM2 creada"

# 4. Crear script de comandos para ejecutar en la VM
log_info "Creando script de comandos para la VM..."
cat > vm-setup-commands.sh << 'EOF'
#!/bin/bash

# Comandos para ejecutar en la VM 34.70.184.11

echo "🔧 Configurando aplicación en la VM..."

# 1. Instalar dependencias
echo "📦 Instalando dependencias..."
npm install

# 2. Generar cliente Prisma
echo "🗄️ Generando cliente Prisma..."
npx prisma generate

# 3. Aplicar migraciones
echo "🔄 Aplicando migraciones de base de datos..."
npx prisma migrate deploy

# 4. Verificar estado de migraciones
echo "✅ Verificando estado de migraciones..."
npx prisma migrate status

# 5. Crear directorios de logs si no existen
mkdir -p logs

# 6. Detener PM2 si está corriendo
echo "🛑 Deteniendo procesos PM2 existentes..."
pm2 delete all || true

# 7. Iniciar aplicación con PM2
echo "🚀 Iniciando aplicación con PM2..."
pm2 start ecosystem.config.js

# 8. Guardar configuración PM2
pm2 save

# 9. Configurar PM2 para inicio automático
pm2 startup

# 10. Mostrar estado
echo "📊 Estado de la aplicación:"
pm2 status
pm2 logs --lines 20

echo ""
echo "✅ Aplicación desplegada exitosamente!"
echo "🌐 Accede a: http://34.70.184.11:3001"
echo "🔍 API Health Check: http://34.70.184.11:3001/health"
EOF

chmod +x vm-setup-commands.sh
log_success "Script de VM creado"

# 5. Crear archivo de verificación de conectividad
log_info "Creando script de verificación..."
cat > test-connection.sh << 'EOF'
#!/bin/bash

echo "🔍 Probando conectividad con la nueva VM..."

# Test de conectividad básica
echo "1. Probando conectividad básica..."
if curl -s --connect-timeout 10 http://34.70.184.11:3001/health > /dev/null; then
    echo "✅ Servidor responde correctamente"
else
    echo "❌ No se puede conectar al servidor"
fi

# Test de API de login
echo "2. Probando endpoint de login..."
response=$(curl -s -w "%{http_code}" -o /dev/null http://34.70.184.11:3001/api/auth/login)
if [ "$response" = "405" ] || [ "$response" = "400" ]; then
    echo "✅ Endpoint de login accesible (código: $response)"
else
    echo "❌ Problema con endpoint de login (código: $response)"
fi

echo "3. Probando CORS..."
curl -s -H "Origin: http://34.70.184.11:3001" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://34.70.184.11:3001/api/auth/login

echo ""
echo "🔧 Si hay problemas, verifica:"
echo "   • Puerto 3001 abierto en firewall"
echo "   • PM2 corriendo: pm2 status"
echo "   • Logs: pm2 logs"
EOF

chmod +x test-connection.sh
log_success "Script de verificación creado"

echo ""
log_success "🎉 Preparación completada!"
echo ""
echo "📋 Archivos creados/actualizados:"
echo "   • ecosystem.config.js - Configuración PM2"
echo "   • vm-setup-commands.sh - Comandos para ejecutar en la VM"
echo "   • test-connection.sh - Script de verificación"
echo ""
echo "🚀 Próximos pasos:"
echo "   1. Sube todos los archivos a tu VM (34.70.184.11)"
echo "   2. En la VM, ejecuta: chmod +x vm-setup-commands.sh"
echo "   3. En la VM, ejecuta: ./vm-setup-commands.sh"
echo "   4. Desde aquí, ejecuta: ./test-connection.sh"
echo ""
echo "📁 Archivos importantes para subir a la VM:"
echo "   • Todo el proyecto actualizado"
echo "   • .env.production"
echo "   • ecosystem.config.js"
echo "   • vm-setup-commands.sh"
echo ""
log_warning "Recuerda: La base de datos ya está configurada, solo necesitas aplicar las migraciones"