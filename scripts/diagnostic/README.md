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

### 3. `corregir-todas-aperturas.mjs`
**Uso:** `node scripts/diagnostic/corregir-todas-aperturas.mjs [--dry-run]`

Corrige todas las aperturas de caja en estado EN_CONTEO o PENDIENTE que tengan
saldos desactualizados. Útil cuando se han corregido los saldos en la tabla `Saldo`
pero las aperturas existentes aún muestran valores viejos.

### 4. `repair-saldo-duplicados.ts`
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

**Problema:** Los operadores no podían abrir caja porque los saldos mostrados no
coincidían con los saldos reales.

**Causa:** Las aperturas de caja se crearon cuando los saldos aún estaban duplicados
por el bug. Después de corregir los saldos en la tabla `Saldo`, las aperturas
existentes seguían mostrando valores viejos.

**Solución:** Se ejecutó `corregir-todas-aperturas.mjs` para actualizar todas las
aperturas existentes con los saldos correctos.

**Puntos afectados:**
- SCALA (EUR: 3339.14 → 1817.07)
- PLAZA DEL VALLE (EUR: 2215.52 → 1182.76)
- OFICINA ROYAL PACIFIC (múltiples monedas)
- AMAZONAS 2 (USD)
- AMAZONAS (USD, EUR, COP)
- EL BOSQUE (múltiples monedas)
- Y otros...

## Notas para Desarrolladores

- Estos scripts están en la carpeta `diagnostic/` para indicar que son herramientas
de diagnóstico y no parte del flujo normal de la aplicación.
- Los scripts usan el cliente Prisma directamente, por lo que deben ejecutarse en el
entorno del servidor con acceso a la base de datos.
- Siempre hacer backup de la base de datos antes de ejecutar scripts de reparación.
