#!/bin/bash

# Script para ejecutar migración completa desde máquina virtual
# Ejecutar desde el directorio raíz del proyecto

echo "🚀 Iniciando migración completa de base de datos..."
echo "📍 Directorio actual: $(pwd)"

# Verificar que estamos en el directorio correcto
if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ Error: No se encuentra prisma/schema.prisma"
    echo "   Asegúrate de estar en el directorio raíz del proyecto"
    exit 1
fi

if [ ! -f "prisma/seed-complete.ts" ]; then
    echo "❌ Error: No se encuentra prisma/seed-complete.ts"
    exit 1
fi

echo "✅ Archivos de Prisma encontrados"

# Paso 1: Generar migración para el campo es_principal
echo ""
echo "📋 Paso 1: Generando migración para campo es_principal..."
npx prisma migrate dev --name add_es_principal_to_punto_atencion

if [ $? -ne 0 ]; then
    echo "❌ Error en la migración. Intentando con migrate deploy..."
    npx prisma migrate deploy
fi

# Paso 2: Generar cliente Prisma
echo ""
echo "📋 Paso 2: Generando cliente Prisma..."
npx prisma generate

if [ $? -ne 0 ]; then
    echo "❌ Error generando cliente Prisma"
    exit 1
fi

# Paso 3: Ejecutar seed completo
echo ""
echo "📋 Paso 3: Ejecutando seed completo..."
echo "⚠️  ADVERTENCIA: Esto eliminará TODOS los datos existentes"
read -p "¿Continuar? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx tsx prisma/seed-complete.ts
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 ¡Migración completada exitosamente!"
        echo ""
        echo "📊 Datos creados:"
        echo "   • 3 Puntos de atención"
        echo "   • 20 Monedas"
        echo "   • 3 Usuarios de prueba"
        echo "   • 60 Saldos iniciales"
        echo "   • 3 Cuadres de caja"
        echo ""
        echo "🔑 Credenciales de prueba:"
        echo "   👤 admin / admin123 (ADMIN)"
        echo "   👤 operador / operador123 (OPERADOR)"
        echo "   👤 concesion / concesion123 (CONCESION)"
        echo ""
        echo "🏢 Puntos disponibles:"
        echo "   • Casa de Cambios Principal (Principal)"
        echo "   • Casa de Cambios Norte"
        echo "   • Casa de Cambios Sur"
    else
        echo "❌ Error ejecutando el seed"
        exit 1
    fi
else
    echo "❌ Migración cancelada por el usuario"
    exit 1
fi

echo ""
echo "✅ Proceso completado. Puedes reiniciar el servidor de la aplicación."