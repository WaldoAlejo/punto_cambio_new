# 🔄 Instrucciones para Migración Completa de Base de Datos

## 📋 **OPCIONES DE EJECUCIÓN**

### **OPCIÓN 1: Con Node.js y Prisma (Recomendado)**

Si tienes Node.js instalado en el servidor:

```bash
# 1. Navegar al directorio del proyecto
cd "/Users/oswaldo/Documents/New Punto cambio/punto_cambio_new"

# 2. Instalar dependencias (si es necesario)
npm install

# 3. Ejecutar migración para agregar campo es_principal
npx prisma migrate dev --name add_es_principal_to_punto_atencion

# 4. Generar cliente Prisma
npx prisma generate

# 5. Ejecutar seed completo
npx tsx prisma/seed-complete.ts
```

### **OPCIÓN 2: Con Script SQL Directo**

Si no tienes Node.js, usa el script SQL:

```bash
# Conectar a PostgreSQL y ejecutar:
psql -h 34.74.127.173 -U postgres -d punto_cambio -f scripts/full-database-reset.sql
```

O ejecutar el contenido del archivo `scripts/full-database-reset.sql` directamente en tu cliente de base de datos.

### **OPCIÓN 3: Ejecutar Script Bash (Si tienes Node.js)**

```bash
# Hacer ejecutable y ejecutar
chmod +x scripts/reset-database.sh
./scripts/reset-database.sh
```

## 🎯 **RESULTADO ESPERADO**

Después de ejecutar cualquiera de las opciones, tendrás:

### **📊 Datos Creados:**

- ✅ **3 Puntos de Atención:**

  - Casa de Cambios Principal (es_principal: true)
  - Casa de Cambios Norte
  - Casa de Cambios Sur

- ✅ **20 Monedas Configuradas:**

  - USD, EUR, GBP, CHF, CAD
  - JPY, CNY, AUD
  - COP, PEN, BRL, ARS, CLP, MXN, VES
  - SEK, NOK, DKK, PLN, RUB

- ✅ **3 Usuarios de Prueba:**

  - `admin` / `admin123` (ADMIN - Punto Principal asignado)
  - `operador` / `operador123` (OPERADOR - Sin punto asignado)
  - `concesion` / `concesion123` (CONCESION - Punto Principal asignado)

- ✅ **60 Saldos Iniciales:**

  - 20 monedas × 3 puntos = 60 saldos
  - USD: $50,000 por punto
  - Otras monedas: $10,000 por punto

- ✅ **3 Cuadres de Caja Iniciales:**
  - Uno por cada punto de atención
  - Estado: ABIERTO
  - Con detalles para todas las monedas

## 🔍 **VERIFICACIÓN**

Para verificar que todo se creó correctamente:

```sql
-- Verificar puntos
SELECT nombre, ciudad, activo, es_principal FROM "PuntoAtencion";

-- Verificar usuarios
SELECT username, nombre, rol,
       CASE WHEN punto_atencion_id IS NOT NULL THEN 'CON PUNTO' ELSE 'SIN PUNTO' END
FROM "Usuario";

-- Verificar saldos
SELECT COUNT(*) as total_saldos FROM "Saldo";

-- Verificar monedas
SELECT codigo, nombre FROM "Moneda" ORDER BY orden_display;
```

## ⚠️ **NOTAS IMPORTANTES**

1. **Backup**: Este proceso elimina TODOS los datos existentes. Haz backup si es necesario.

2. **Passwords**: Todos los usuarios tienen passwords hasheados con bcrypt:

   - Hash: `$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi`
   - Corresponde a: `admin123`, `operador123`, `concesion123`

3. **Punto Principal**: Solo hay un punto marcado como `es_principal = true`

4. **Operador**: Inicia sin punto asignado, debe seleccionar uno al hacer login

5. **Saldos**: Se crean automáticamente para todas las combinaciones punto-moneda

## 🚀 **DESPUÉS DE LA MIGRACIÓN**

1. **Reiniciar el servidor** de la aplicación
2. **Probar login** con cada usuario
3. **Verificar permisos** por rol
4. **Confirmar** que el operador puede seleccionar puntos
5. **Validar** que los saldos se muestran correctamente

## 📞 **SOPORTE**

Si encuentras problemas:

1. Verifica la conexión a la base de datos
2. Revisa los logs del servidor
3. Confirma que todas las tablas existen
4. Valida que los usuarios se crearon correctamente
