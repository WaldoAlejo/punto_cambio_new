#!/bin/bash

echo "🔧 Script de Reparación de Migración"
echo "=================================="

echo "1. Verificando conexión a la base de datos..."
npx prisma db pull --force

echo "2. Sincronizando esquema con la base de datos..."
npx prisma db push --accept-data-loss

echo "3. Generando cliente Prisma..."
npx prisma generate

echo "4. Ejecutando seed..."
npx prisma db seed

echo "5. Verificando estado final..."
npx prisma migrate status

echo "✅ Migración completada!"
echo ""
echo "🔑 Credenciales de prueba:"
echo "Usuario: administrativo"
echo "Contraseña: admin123"
echo "Rol: ADMINISTRATIVO"