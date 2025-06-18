
#!/bin/bash

# Health check script
API_URL=${API_URL:-"http://localhost:3001"}

echo "🔍 Verificando salud de la aplicación..."

# Check API health
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $API_URL/health)

if [ $HTTP_CODE -eq 200 ]; then
    echo "✅ API está funcionando correctamente"
else
    echo "❌ API no responde correctamente (HTTP $HTTP_CODE)"
    exit 1
fi

# Check database connection
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $API_URL/api/test)

if [ $HTTP_CODE -eq 200 ]; then
    echo "✅ Base de datos conectada"
else
    echo "❌ Error de conexión a base de datos (HTTP $HTTP_CODE)"
    exit 1
fi

# Check PM2 process
if pm2 list | grep -q "punto-cambio-api.*online"; then
    echo "✅ Proceso PM2 en línea"
else
    echo "❌ Proceso PM2 no está en línea"
    exit 1
fi

echo "🎉 Todos los checks pasaron exitosamente"
