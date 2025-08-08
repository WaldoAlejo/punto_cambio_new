#!/bin/bash

echo "🔧 Aplicando migración manual para es_principal..."

# Aplicar la migración SQL directamente
echo "📋 Agregando columna es_principal..."
npx prisma db execute --file prisma/migrations/20250808110320_add_es_principal_and_unique_nombre/migration.sql

if [ $? -eq 0 ]; then
    echo "✅ Migración aplicada exitosamente"
    
    echo "📋 Regenerando cliente Prisma..."
    npx prisma generate
    
    echo "📋 Ejecutando seed..."
    npx prisma db seed
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 ¡Todo completado exitosamente!"
        echo ""
        echo "🔑 Credenciales disponibles:"
        echo "   admin/admin123 (ADMIN)"
        echo "   operador/operador123 (OPERADOR general)"
        echo "   operador1/operador123 (OPERADOR amazonas1)"
    else
        echo "❌ Error ejecutando el seed"
    fi
else
    echo "❌ Error aplicando la migración"
fi