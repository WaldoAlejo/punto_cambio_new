# Scripts de Diagnóstico y Reparación

Esta carpeta contiene scripts utilizados para diagnosticar y reparar problemas específicos en la base de datos.

## Scripts Disponibles

### 1. `repair-saldos.mjs`
**Uso:** `node scripts/diagnostic/repair-saldos.mjs [--dry-run]`

Repara los saldos que fueron duplicados debido a un bug en el servicio `movimientoSaldoService.ts`.
El bug causaba que al asignar saldo inicial, el valor se duplicara en la tabla `Saldo`.

**Parámetros:**
- `--dry-run`: Solo muestra las diferencias sin aplicar correcciones

### 2. `corregir-apertura-scala.mjs`
**Uso:** `node scripts/diagnostic/corregir-apertura-scala.mjs`

Corrige la apertura de caja de SCALA para que muestre el saldo correcto.
Este script fue necesario porque la apertura existente tenía el saldo desactualizado
(3339.14 en lugar de 1817.07).

### 3. `repair-saldo-duplicados.ts`
Versión TypeScript del script de reparación (requiere compilación).

## Historial de Problemas Resueltos

### 2026-03-30: Bug de Duplicación en Asignación de Saldos

**Problema:** Al asignar saldo inicial (ej: 1500 EUR), el saldo se duplicaba en la tabla `Saldo`.

**Causa:** El servicio `movimientoSaldoService.ts` ignoraba el parámetro `saldoBucket: "NINGUNO"`
para movimientos tipo `SALDO_INICIAL`, causando que se incrementara el saldo dos veces:
1. Una vez en la transacción de `saldos-iniciales.ts`
2. Otra vez en el servicio `registrarMovimientoSaldo`

**Solución:** Se modificó `server/services/movimientoSaldoService.ts` para respetar el
parámetro `saldoBucket: "NINGUNO"` y no sincronizar la tabla `Saldo` cuando ya fue
actualizada manualmente.

**Datos Corregidos:**
- SCALA/EUR: 3339.14 → 1817.07
- BOVEDA QUITO/EUR: 77750.00 → 33325.00
- CAJA CHICA/EUR: 2000.00 → 0.00
- CAJA CHICA/USD: 34320.00 → 7320.00
- CAJA CHICA EUROS/EUR: 4000.00 → 2000.00
- PLAZA DEL VALLE/EUR: 2215.52 → 1182.76
- AMAZONAS 2/USD: 697.78 → 809.58

### 2026-03-30: Apertura de Caja con Saldo Desactualizado

**Problema:** El operador de SCALA no podía abrir caja porque el saldo mostrado (3339.14)
no coincidía con el saldo real (1817.07).

**Causa:** La apertura de caja se creó cuando el saldo aún estaba duplicado.

**Solución:** Se ejecutó `corregir-apertura-scala.mjs` para actualizar el saldo esperado
en la apertura existente.

## Notas para Desarrolladores

- Estos scripts están en la carpeta `diagnostic/` para indicar que son herramientas
de diagnóstico y no parte del flujo normal de la aplicación.
- Los scripts usan el cliente Prisma directamente, por lo que deben ejecutarse en el
entorno del servidor con acceso a la base de datos.
- Siempre hacer backup de la base de datos antes de ejecutar scripts de reparación.
