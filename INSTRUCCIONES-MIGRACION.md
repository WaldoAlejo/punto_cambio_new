# 🚀 INSTRUCCIONES PARA MIGRACIÓN COMPLETA

## 📋 **EJECUTAR EN TU MÁQUINA VIRTUAL**

### **OPCIÓN 1: Deploy Automático (Recomendado)**

```bash
# 1. Navegar al directorio del proyecto
cd /ruta/a/tu/proyecto/punto_cambio_new

# 2. Ejecutar deploy completo (migración + seed automático)
npx prisma migrate deploy
npx prisma generate
npx prisma db seed
```

### **OPCIÓN 2: Script Automatizado**

```bash
# Hacer ejecutable y ejecutar
chmod +x scripts/deploy-simple.sh
./scripts/deploy-simple.sh
```

### **OPCIÓN 3: Comandos individuales**

```bash
# Deploy de migraciones
npx prisma migrate deploy

# Generar cliente
npx prisma generate

# Ejecutar seed
npx prisma db seed
```

## 🎯 **RESULTADO ESPERADO**

Después de ejecutar exitosamente verás:

```
🎉 ¡Seed completo ejecutado exitosamente!

📊 Resumen de datos creados:
   • 3 Puntos de atención:
     - Casa de Cambios Principal (Principal)
     - Casa de Cambios Norte
     - Casa de Cambios Sur
   • 20 Monedas configuradas
   • 3 Usuarios de prueba:
     - admin (ADMIN)
     - operador (OPERADOR)
     - concesion (CONCESION)
   • 60 Saldos iniciales (todas las monedas en todos los puntos)
   • 3 Cuadres de caja iniciales

🔑 Credenciales de acceso:
   👤 ADMIN:
      • Usuario: admin
      • Contraseña: admin123
   👤 OPERADOR:
      • Usuario: operador
      • Contraseña: operador123
   👤 CONCESION:
      • Usuario: concesion
      • Contraseña: concesion123

🏢 Puntos de atención disponibles:
   • Principal: Rabida y Juan Leon Mera, Quito
   • Norte: Av. 6 de Diciembre y Eloy Alfaro, Quito
   • Sur: Av. Maldonado y Morán Valverde, Quito
```

## ✅ **VERIFICACIÓN**

### **1. Probar en la aplicación:**

1. Reiniciar servidor: `npm run dev:server`
2. Ir a tu URL de frontend
3. Probar login con cada usuario

### **2. Verificar en base de datos:**

```sql
SELECT COUNT(*) FROM "PuntoAtencion"; -- Debe ser 3
SELECT COUNT(*) FROM "Usuario";       -- Debe ser 3
SELECT COUNT(*) FROM "Moneda";        -- Debe ser 20
SELECT COUNT(*) FROM "Saldo";         -- Debe ser 60
```

## 🎉 **PROBLEMA RESUELTO**

Después de esta migración:

- ✅ **URLs corregidas**: No más `/api/api/` duplicadas
- ✅ **Operadores pueden seleccionar puntos**: 3 puntos disponibles
- ✅ **Usuarios de prueba listos**: admin, operador, concesion
- ✅ **Sistema completamente funcional**: Saldos, cuadres, permisos

**El operador ahora podrá:**

1. Hacer login exitosamente
2. Ver selector de puntos disponibles
3. Seleccionar un punto e iniciar jornada
4. Acceder al dashboard operativo

**¡El problema está completamente solucionado!** 🎊
