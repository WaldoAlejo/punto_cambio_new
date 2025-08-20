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
echo "   • Variables de entorno: pm2 env 0"
