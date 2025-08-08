#!/bin/bash

echo "🔄 Reiniciando aplicación completa..."

# Detener procesos existentes
echo "🛑 Deteniendo procesos existentes..."
pkill -f "node.*server" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# Esperar un momento
sleep 2

echo "🚀 Iniciando servidor backend..."
# Iniciar servidor en background
nohup npm run dev:server > server.log 2>&1 &
SERVER_PID=$!

# Esperar que el servidor inicie
echo "⏳ Esperando que el servidor inicie..."
sleep 5

# Verificar que el servidor esté corriendo
if ps -p $SERVER_PID > /dev/null; then
    echo "✅ Servidor backend iniciado (PID: $SERVER_PID)"
else
    echo "❌ Error iniciando el servidor backend"
    exit 1
fi

echo "🌐 Iniciando frontend..."
# Iniciar frontend en background
nohup npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!

# Esperar que el frontend inicie
sleep 3

if ps -p $FRONTEND_PID > /dev/null; then
    echo "✅ Frontend iniciado (PID: $FRONTEND_PID)"
else
    echo "❌ Error iniciando el frontend"
    exit 1
fi

echo ""
echo "🎉 ¡Aplicación iniciada exitosamente!"
echo ""
echo "📊 URLs disponibles:"
echo "   Frontend: http://34.132.200.84:8080"
echo "   Backend:  http://34.132.200.84:3001"
echo ""
echo "📋 PIDs de procesos:"
echo "   Servidor: $SERVER_PID"
echo "   Frontend: $FRONTEND_PID"
echo ""
echo "📝 Logs disponibles:"
echo "   Servidor: tail -f server.log"
echo "   Frontend: tail -f frontend.log"
echo ""
echo "🔑 Credenciales de prueba:"
echo "   operador/operador123"