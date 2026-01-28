# Problema: Western Union en PLAZA DEL VALLE - Análisis y Solución

## Fecha: 28 de Enero de 2026

## Resumen del Problema

El operador reportó que se registró un servicio externo de Western Union en la oficina PLAZA DEL VALLE:

1. **Error inicial**: El servicio fue ingresado como INGRESO cuando debía ser EGRESO
2. **Intento de corrección**: Se solicitó anulación al administrador
3. **Problema con anulaciones**: Las anulaciones SUMABAN saldo en lugar de RESTARLO
4. **Saldo esperado**: El cierre de caja debe cuadrar en **$1,996.24**

## Flujo Normal de Western Union

### Cuando el operador INGRESA el tipo correcto (EGRESO):

```
Cliente solicita Western Union (pagar $100)
Operador registra: EGRESO de $100

Efectos:
- Saldo Western Union Digital: NO CAMBIA (Western es servicio con asignación)
- Saldo USD General (efectivo): -$100 (sale dinero del punto)
```

### Cuando el operador INGRESÓ ERRÓNEAMENTE como INGRESO:

```
Cliente solicita Western Union (pagar $100)
Operador registra MAL: INGRESO de $100

Efectos INCORRECTOS:
- Saldo Western Union Digital: -$100 (se resta del crédito asignado)
- Saldo USD General (efectivo): +$100 (se suma al efectivo - INCORRECTO!)
```

## Análisis del Código

### Lógica de INGRESO/EGRESO para servicios con asignación (Western, Bancos, YaGanaste)

**Archivo**: `server/routes/servicios-externos.ts` - Líneas 230-240

```typescript
// INGRESO (Cliente paga servicio) -> RESTA del saldo asignado (se usa el crédito)
// EGRESO (Operador repone dinero) -> SUMA al saldo asignado (se repone el crédito)
const deltaDigital = tipo_movimiento === "INGRESO" ? -montoNum : montoNum;
```

**Para el saldo general (efectivo)**:

```typescript
// INGRESO (cliente paga servicio) → SUMA al efectivo (entra dinero)
// EGRESO (operador paga servicio) → RESTA del efectivo (sale dinero)
const deltaGeneral = tipo_movimiento === "INGRESO" ? montoNum : -montoNum;
```

### Lógica de ELIMINACIÓN de movimientos

**Archivo**: `server/routes/servicios-externos.ts` - Líneas 502-543

La lógica de reversión cuando se ELIMINA un movimiento:

```typescript
// 1. REVERTIR SALDO DIGITAL DEL SERVICIO
if (tieneAsignacion) {
  // Si fue INGRESO (restó digital), ahora sumamos
  // Si fue EGRESO (sumó digital), ahora restamos
  const mult = mov.tipo_movimiento === "INGRESO" ? 1 : -1;
  
  await tx.servicioExternoSaldo.update({
    where: { id: sSvc.id },
    data: {
      cantidad: { increment: montoNum * mult },
      ...
    },
  });
}

// 2. REVERTIR SALDO FÍSICO GENERAL
// Si fue INGRESO (sumó físico), ahora restamos
// Si fue EGRESO (restó físico), ahora sumamos
const mult = mov.tipo_movimiento === "INGRESO" ? -1 : 1;

await tx.saldo.update({
  where: { id: sGen.id },
  data: {
    cantidad: nuevoTotal, // = saldoAnterior + (montoNum * mult)
    ...
  },
});
```

## El Problema Identificado

### Escenario Real:

1. **Movimiento Original (INCORRECTO)**:
   - Tipo: INGRESO
   - Monto: $X
   - Efecto en saldo digital Western: -$X (restó)
   - Efecto en saldo USD general: +$X (sumó) ❌ INCORRECTO

2. **Al ELIMINAR el movimiento INGRESO**:
   - Saldo digital Western: +$X (revierte, suma)
   - Saldo USD general: -$X (revierte, resta)

3. **Resultado después de la eliminación**:
   - Saldo digital Western: $0 (correcto, vuelve al valor inicial)
   - Saldo USD general: $0 (correcto, vuelve al valor inicial)

### ⚠️ CONCLUSIÓN: La lógica de eliminación es CORRECTA

La eliminación SÍ revierte correctamente los movimientos. El problema es que:
- El movimiento original estaba mal (INGRESO en lugar de EGRESO)
- Al eliminar, solo se revierte el error, pero no se corrige el flujo real

## Solución Correcta

Para corregir el problema, el administrador debe:

1. **Eliminar el movimiento INGRESO erróneo** (esto ya se hizo)
   - Esto revierte el efecto incorrecto

2. **Crear un nuevo movimiento EGRESO correcto**
   - Servicio: WESTERN
   - Tipo: EGRESO
   - Monto: [monto del servicio original]
   - Esto aplicará:
     - Saldo Western Digital: NO CAMBIA (Western es servicio con asignación, EGRESO suma, pero no aplica)
     - Saldo USD General: -$X (sale dinero, CORRECTO)

## Verificación del Saldo Final

Para verificar que todo cuadre correctamente:

```
Saldo USD General al cierre debe ser: $1,996.24

Verificar:
- Saldo inicial del día
+ Todos los INGRESOS (clientes pagan servicios, cambios que dejan USD, etc.)
- Todos los EGRESOS (Western Union, transferencias, compras, etc.)
= $1,996.24
```

## Recomendaciones

1. **Capacitación**: Explicar la diferencia entre INGRESO y EGRESO en servicios externos
   - INGRESO = Cliente PAGA un servicio (entra dinero al punto)
   - EGRESO = Operador PAGA un servicio (sale dinero del punto)

2. **Validación en UI**: Agregar confirmación antes de registrar servicios Western Union
   - "¿El cliente está PAGANDO por un servicio Western Union? → INGRESO"
   - "¿Estás ENVIANDO dinero vía Western Union? → EGRESO"

3. **Auditoría**: Revisar todos los movimientos del día para identificar otros posibles errores

## Script de Verificación

Ver: `scripts/investigate-plaza-valle.ts` y `scripts/fix-plaza-valle-western.ts`
