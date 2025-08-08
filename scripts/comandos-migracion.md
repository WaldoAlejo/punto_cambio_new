# 📋 Comandos para Migración - Ejecutar en Máquina Virtual

## 🎯 **COMANDOS PASO A PASO**

### **1. Navegar al directorio del proyecto**

```bash
cd "/ruta/a/tu/proyecto/punto_cambio_new"
```

### **2. Verificar archivos necesarios**

```bash
ls -la prisma/
# Debe mostrar: schema.prisma y seed-complete.ts
```

### **3. Generar migración para el nuevo campo**

```bash
npx prisma migrate dev --name add_es_principal_to_punto_atencion
```

**Si el comando anterior falla, usar:**

```bash
npx prisma migrate deploy
```

### **4. Generar cliente Prisma**

```bash
npx prisma generate
```

### **5. Ejecutar seed completo (⚠️ ELIMINA TODOS LOS DATOS)**

```bash
npx tsx prisma/seed-complete.ts
```

## 🚀 **COMANDO ÚNICO (Automatizado)**

Si prefieres ejecutar todo de una vez:

```bash
# Hacer ejecutable el script
chmod +x scripts/deploy-migration.sh

# Ejecutar
./scripts/deploy-migration.sh
```

## 🔍 **VERIFICACIÓN POST-MIGRACIÓN**

### **Verificar en la base de datos:**

```sql
-- Contar registros creados
SELECT 'Puntos' as tabla, COUNT(*) as total FROM "PuntoAtencion"
UNION ALL
SELECT 'Usuarios' as tabla, COUNT(*) as total FROM "Usuario"
UNION ALL
SELECT 'Monedas' as tabla, COUNT(*) as total FROM "Moneda"
UNION ALL
SELECT 'Saldos' as tabla, COUNT(*) as total FROM "Saldo";

-- Ver usuarios creados
SELECT username, nombre, rol FROM "Usuario";

-- Ver puntos creados
SELECT nombre, ciudad, es_principal FROM "PuntoAtencion";
```

### **Probar en la aplicación:**

1. Reiniciar servidor: `npm run dev` o `npm start`
2. Ir a `http://localhost:5173` (o tu URL)
3. Probar login con:
   - `admin` / `admin123`
   - `operador` / `operador123`
   - `concesion` / `concesion123`

## ⚠️ **NOTAS IMPORTANTES**

1. **Backup**: Este proceso elimina TODOS los datos existentes
2. **Conexión**: Verifica que la variable `DATABASE_URL` esté correcta
3. **Dependencias**: Asegúrate de tener `tsx` instalado: `npm install -g tsx`
4. **Permisos**: El usuario de BD debe tener permisos para crear/eliminar tablas

## 🆘 **SOLUCIÓN DE PROBLEMAS**

### **Error: "tsx not found"**

```bash
npm install -g tsx
# o
npx tsx prisma/seed-complete.ts
```

### **Error: "Prisma Client not generated"**

```bash
npx prisma generate
```

### **Error: "Migration failed"**

```bash
# Resetear migraciones
npx prisma migrate reset --force
npx prisma migrate deploy
```

### **Error de conexión a BD**

```bash
# Verificar variable de entorno
echo $DATABASE_URL

# O verificar archivo .env
cat .env
```

## 📊 **RESULTADO ESPERADO**

Después de ejecutar exitosamente:

```
✅ 3 Puntos de atención creados
✅ 20 Monedas configuradas
✅ 3 Usuarios de prueba creados
✅ 60 Saldos iniciales (20 monedas × 3 puntos)
✅ 3 Cuadres de caja iniciales
✅ Sistema listo para usar
```

**🎉 El operador podrá seleccionar puntos y el sistema funcionará correctamente.**
