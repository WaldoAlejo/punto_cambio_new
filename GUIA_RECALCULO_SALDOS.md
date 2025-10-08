# 📘 Guía de Recalculación de Saldos

## 🚨 Problemas Identificados en el Script Original

El script `recalcularYLimpiarDB.ts` tenía varios problemas críticos:

### 1. **No filtraba transferencias por estado** ❌

- Contabilizaba TODAS las transferencias (PENDIENTES, APROBADAS, RECHAZADAS)
- **Correcto**: Solo las transferencias **APROBADAS** deben afectar los saldos

### 2. **No filtraba cambios de divisa por estado** ❌

- Contabilizaba todos los cambios sin verificar el estado
- **Correcto**: Solo los cambios **COMPLETADOS** deben afectar los saldos

### 3. **Eliminaba duplicados automáticamente** ⚠️

- Podría eliminar registros legítimos
- **Correcto**: Analizar primero, eliminar después (manualmente o con confirmación)

### 4. **Sintaxis mixta** ⚠️

- Mezclaba `require()` con TypeScript
- **Correcto**: Usar imports de ES6

---

## ✅ Solución Implementada

Se crearon **2 scripts nuevos y seguros**:

### 1. `recalcularYLimpiarDB-FIXED.ts` - Script Principal

**Qué hace:**

- ✅ Analiza duplicados SIN eliminarlos
- ✅ Recalcula saldos correctamente:
  - Solo transferencias **APROBADAS**
  - Solo cambios de divisa **COMPLETADOS**
  - Todos los servicios externos
- ✅ Muestra diferencias antes/después
- ✅ Solo actualiza saldos que tienen diferencias

**Cómo ejecutar:**

```bash
npx ts-node server/scripts/recalcularYLimpiarDB-FIXED.ts
```

**Salida esperada:**

```
🚀 Iniciando análisis y recalculación de base de datos...

============================================================

📊 Analizando duplicados en CambioDivisa...
✅ No se encontraron duplicados en CambioDivisa

📊 Analizando duplicados en Transferencia...
✅ No se encontraron duplicados en Transferencia

📊 Analizando duplicados en ServicioExternoMovimiento...
✅ No se encontraron duplicados en ServicioExternoMovimiento

============================================================

🔄 Recalculando saldos...

📝 BOVEDA - EUR:
   Anterior: 8600.00
   Calculado: 13600.00
   Diferencia: 5000.00
   (Ingresos: 50000.00 - Egresos: 36400.00)

✅ Recalculación completada:
   - 3 saldos actualizados
   - 15 saldos sin cambios

============================================================

✅ Proceso completado exitosamente
```

---

### 2. `eliminar-duplicados-seguro.ts` - Eliminación de Duplicados

**Qué hace:**

- ✅ Identifica grupos de duplicados
- ✅ Mantiene el registro MÁS ANTIGUO de cada grupo
- ✅ Modo DRY-RUN por defecto (simulación)
- ✅ Requiere flag `--execute` para eliminar realmente

**Cómo ejecutar:**

**Paso 1: Simulación (recomendado primero)**

```bash
npx ts-node server/scripts/eliminar-duplicados-seguro.ts
```

**Paso 2: Ejecución real (solo si estás seguro)**

```bash
npx ts-node server/scripts/eliminar-duplicados-seguro.ts -- --execute
```

---

## 📋 Proceso Recomendado

### Paso 1: Hacer Backup de la Base de Datos

```bash
# PostgreSQL
pg_dump -U usuario -d nombre_db > backup_antes_recalculo.sql

# O desde la aplicación de base de datos
```

### Paso 2: Ejecutar el Script de Recalculación

```bash
npx ts-node server/scripts/recalcularYLimpiarDB-FIXED.ts
```

**Revisar la salida:**

- ¿Se encontraron duplicados? → Investigar manualmente
- ¿Los saldos calculados son correctos? → Verificar en la aplicación
- ¿Hay diferencias grandes? → Investigar por qué

### Paso 3: Si hay duplicados, analizarlos

```bash
# Ejecutar en modo simulación
npx ts-node server/scripts/eliminar-duplicados-seguro.ts
```

**Revisar la salida:**

- ¿Los duplicados son realmente duplicados?
- ¿Es seguro eliminarlos?
- ¿Se mantiene el registro correcto?

### Paso 4: Eliminar duplicados (opcional)

```bash
# Solo si estás 100% seguro
npx ts-node server/scripts/eliminar-duplicados-seguro.ts -- --execute
```

### Paso 5: Recalcular saldos nuevamente

```bash
# Después de eliminar duplicados
npx ts-node server/scripts/recalcularYLimpiarDB-FIXED.ts
```

### Paso 6: Verificar en la aplicación

- Revisar saldos en BOVEDA
- Revisar saldos en otros puntos
- Verificar que los totales cuadren
- Probar crear una nueva transferencia

---

## 🔍 Diferencias Clave: Original vs. Corregido

### Script Original (`recalcularYLimpiarDB.ts`)

```typescript
// ❌ INCORRECTO: Toma TODAS las transferencias
const transferenciasEntrada = await prisma.transferencia.findMany({
  where: { destino_id: punto_atencion_id, moneda_id },
});
```

### Script Corregido (`recalcularYLimpiarDB-FIXED.ts`)

```typescript
// ✅ CORRECTO: Solo transferencias APROBADAS
const transferenciasEntrada = await prisma.transferencia.findMany({
  where: {
    destino_id: punto_atencion_id,
    moneda_id,
    estado: "APROBADO", // ← Filtro crítico
  },
});
```

---

## ⚠️ Advertencias Importantes

### 1. **NO ejecutar el script original**

El script `recalcularYLimpiarDB.ts` tiene errores y puede causar saldos incorrectos.

### 2. **Siempre hacer backup primero**

Antes de ejecutar cualquier script que modifique datos.

### 3. **Revisar la salida cuidadosamente**

Si ves diferencias grandes o inesperadas, investiga antes de continuar.

### 4. **Duplicados pueden ser legítimos**

Dos operaciones con los mismos valores no siempre son duplicados. Revisa manualmente.

### 5. **Verificar después de ejecutar**

Siempre verifica los saldos en la aplicación después de ejecutar los scripts.

---

## 🎯 Casos de Uso

### Caso 1: Solo quiero verificar si hay problemas

```bash
npx ts-node server/scripts/recalcularYLimpiarDB-FIXED.ts
```

- No elimina nada
- Solo muestra análisis y recalcula saldos

### Caso 2: Encontré duplicados y quiero ver qué se eliminaría

```bash
npx ts-node server/scripts/eliminar-duplicados-seguro.ts
```

- Modo simulación
- No elimina nada

### Caso 3: Quiero corregir todo

```bash
# 1. Backup
pg_dump -U usuario -d nombre_db > backup.sql

# 2. Recalcular
npx ts-node server/scripts/recalcularYLimpiarDB-FIXED.ts

# 3. Si hay duplicados, simular eliminación
npx ts-node server/scripts/eliminar-duplicados-seguro.ts

# 4. Si todo se ve bien, eliminar duplicados
npx ts-node server/scripts/eliminar-duplicados-seguro.ts -- --execute

# 5. Recalcular nuevamente
npx ts-node server/scripts/recalcularYLimpiarDB-FIXED.ts

# 6. Verificar en la aplicación
```

---

## 📊 Entendiendo la Lógica de Saldos

### Fórmula:

```
Saldo = Ingresos - Egresos
```

### Ingresos:

- Cambios de divisa donde este punto recibe la moneda destino (COMPLETADOS)
- Transferencias donde este punto es el destino (APROBADAS)
- Servicios externos tipo INGRESO

### Egresos:

- Cambios de divisa donde este punto entrega la moneda origen (COMPLETADOS)
- Transferencias donde este punto es el origen (APROBADAS)
- Servicios externos tipo EGRESO

### Estados que NO deben contabilizarse:

- Transferencias PENDIENTES ❌
- Transferencias RECHAZADAS ❌
- Cambios de divisa no COMPLETADOS ❌

---

## 🆘 Solución de Problemas

### Error: "Cannot find module '../lib/prisma'"

```bash
# Asegúrate de estar en el directorio raíz del proyecto
cd /Users/oswaldo/Documents/Punto\ Cambio/punto_cambio_new
npx ts-node server/scripts/recalcularYLimpiarDB-FIXED.ts
```

### Error: "Type 'Decimal' is not assignable..."

```bash
# Regenerar el cliente de Prisma
npx prisma generate
```

### Los saldos no cuadran después del recalculo

1. Verifica que no haya transferencias duplicadas en `movimiento_saldo`
2. Ejecuta el script de diagnóstico de transferencias:
   ```bash
   npx ts-node server/scripts/diagnose-transfer-duplication.ts
   ```
3. Revisa manualmente las operaciones en la base de datos

---

## 📝 Notas Finales

- Los scripts nuevos son **seguros** y **no destructivos** por defecto
- Siempre revisa la salida antes de tomar acciones
- Si tienes dudas, consulta antes de ejecutar con `--execute`
- Los scripts están diseñados para ser **idempotentes** (puedes ejecutarlos múltiples veces)

---

**Creado**: 2025-01-07  
**Versión**: 1.0  
**Relacionado con**: Fix de duplicación de transferencias
