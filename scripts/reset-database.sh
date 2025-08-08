#!/bin/bash

# Script para resetear completamente la base de datos y ejecutar el seed

echo "🔄 Iniciando reset completo de la base de datos..."

# Navegar al directorio del proyecto
cd "/Users/oswaldo/Documents/New Punto cambio/punto_cambio_new"

echo "📋 Paso 1: Reseteando la base de datos..."
npx prisma migrate reset --force

echo "📋 Paso 2: Aplicando migraciones..."
npx prisma migrate deploy

echo "📋 Paso 3: Generando cliente Prisma..."
npx prisma generate

echo "📋 Paso 4: Ejecutando seed completo..."
npx tsx prisma/seed-complete.ts

echo "✅ Reset completo finalizado!"
echo ""
echo "🎯 La base de datos ha sido completamente reinicializada con:"
echo "   • 3 Puntos de atención"
echo "   • 3 Usuarios de prueba (admin, operador, concesion)"
echo "   • 25 Monedas configuradas"
echo "   • Saldos iniciales en todos los puntos"
echo "   • Cuadres de caja iniciales"
echo ""
echo "🔑 Credenciales:"
echo "   admin/admin123 (ADMIN)"
echo "   operador/operador123 (OPERADOR)"
echo "   concesion/concesion123 (CONCESION)"