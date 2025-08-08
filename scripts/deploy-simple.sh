#!/bin/bash

# Script simple para deploy con migración y seed automático
echo "🚀 Ejecutando migración y seed automático..."

# Paso 1: Deploy de migraciones
echo "📋 Paso 1: Aplicando migraciones..."
npx prisma migrate deploy

if [ $? -ne 0 ]; then
    echo "❌ Error en migrate deploy"
    exit 1
fi

# Paso 2: Generar cliente
echo "📋 Paso 2: Generando cliente Prisma..."
npx prisma generate

if [ $? -ne 0 ]; then
    echo "❌ Error generando cliente"
    exit 1
fi

# Paso 3: Ejecutar seed (configurado en package.json)
echo "📋 Paso 3: Ejecutando seed automático..."
npx prisma db seed

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 ¡Deploy completado exitosamente!"
    echo ""
    echo "✅ Migraciones aplicadas"
    echo "✅ Cliente Prisma generado"
    echo "✅ Seed ejecutado"
    echo ""
    echo "🔑 Credenciales disponibles:"
    echo "   admin/admin123 (ADMIN)"
    echo "   operador/operador123 (OPERADOR)"
    echo "   concesion/concesion123 (CONCESION)"
else
    echo "❌ Error ejecutando el seed"
    exit 1
fi