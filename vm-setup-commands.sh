#!/bin/bash

# Comandos para ejecutar en la VM 34.70.184.11

echo "🔧 Configurando aplicación en la VM..."

# 1. Instalar dependencias
echo "📦 Instalando dependencias..."
npm install

# 2. Construir la aplicación
echo "🏗️ Construyendo aplicación..."
npm run build

# 3. Generar cliente Prisma
echo "🗄️ Generando cliente Prisma..."
npx prisma generate

# 4. Aplicar migraciones
echo "🔄 Aplicando migraciones de base de datos..."
npx prisma migrate deploy

# 5. Verificar estado de migraciones
echo "✅ Verificando estado de migraciones..."
npx prisma migrate status

# 6. Crear directorios de logs si no existen
mkdir -p logs

# 7. Detener PM2 si está corriendo
echo "🛑 Deteniendo procesos PM2 existentes..."
pm2 delete all || true

# 8. Iniciar aplicación con PM2
echo "🚀 Iniciando aplicación con PM2..."
pm2 start ecosystem.config.js

# 9. Guardar configuración PM2
pm2 save

# 10. Configurar PM2 para inicio automático (ejecutar como root si es necesario)
echo "⚙️ Configurando PM2 para inicio automático..."
pm2 startup || echo "⚠️ Ejecuta 'sudo pm2 startup' manualmente si es necesario"

# 11. Mostrar estado
echo "📊 Estado de la aplicación:"
pm2 status
pm2 logs --lines 20

echo ""
echo "✅ Aplicación desplegada exitosamente!"
echo "🌐 Accede a: http://34.70.184.11:3001"
echo "🔍 API Health Check: http://34.70.184.11:3001/health"
echo ""
echo "🔧 Comandos útiles:"
echo "   • Ver logs: pm2 logs"
echo "   • Reiniciar: pm2 restart all"
echo "   • Estado: pm2 status"
echo "   • Monitoreo: pm2 monit"
