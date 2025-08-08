#!/bin/bash

echo "🔧 Aplicando migración manual para es_principal..."

# Método 1: Usar psql directamente (más confiable)
echo "📋 Conectando a la base de datos..."

# Leer variables de entorno del archivo .env
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Aplicar SQL directamente con psql
echo "📋 Agregando columna es_principal..."
psql "$DATABASE_URL" -c "
ALTER TABLE \"PuntoAtencion\" ADD COLUMN IF NOT EXISTS \"es_principal\" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS \"PuntoAtencion_nombre_key\" ON \"PuntoAtencion\"(\"nombre\");
"

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
        echo "🔄 Reiniciando servidor para aplicar cambios..."
        # Intentar reiniciar con diferentes métodos
        if command -v pm2 &> /dev/null; then
            pm2 restart all
        elif pgrep -f "node.*server" > /dev/null; then
            pkill -f "node.*server"
            echo "⚠️  Servidor detenido. Reinicia manualmente con: npm run dev:server"
        else
            echo "⚠️  Reinicia el servidor manualmente para aplicar los cambios"
        fi
        
        echo ""
        echo "🔑 Credenciales disponibles:"
        echo "   admin/admin123 (ADMIN)"
        echo "   operador/operador123 (OPERADOR general)"
        echo "   operador1/operador123 (OPERADOR amazonas1)"
        echo ""
        echo "🏢 Puntos disponibles:"
        echo "   • Casa de Cambios Principal"
        echo "   • amazonas1"
        echo "   • Casa de Cambios Norte"
    else
        echo "❌ Error ejecutando el seed"
    fi
else
    echo "❌ Error aplicando la migración con psql"
    echo "🔄 Intentando con prisma db execute..."
    
    # Método 2: Fallback con prisma db execute
    npx prisma db execute --file prisma/migrations/20250808110320_add_es_principal_and_unique_nombre/migration.sql --schema prisma/schema.prisma
    
    if [ $? -eq 0 ]; then
        echo "✅ Migración aplicada exitosamente con Prisma"
        
        echo "📋 Regenerando cliente Prisma..."
        npx prisma generate
        
        echo "📋 Ejecutando seed..."
        npx prisma db seed
    else
        echo "❌ Error con ambos métodos. Ejecuta manualmente:"
        echo "psql \"\$DATABASE_URL\" -c \"ALTER TABLE \\\"PuntoAtencion\\\" ADD COLUMN IF NOT EXISTS \\\"es_principal\\\" BOOLEAN NOT NULL DEFAULT false;\""
    fi
fi