# 🔍 Análisis Completo del Flujo del Aplicativo - Sistema de Balance

## 📋 Resumen Ejecutivo

Este documento analiza el flujo completo de la aplicación en producción, identificando **problemas críticos** en la actualización de saldos y proponiendo soluciones.

### ⚠️ PROBLEMA CRÍTICO IDENTIFICADO

**Los cambios de divisa con estado PENDIENTE están actualizando los saldos inmediatamente**, lo que causa inconsistencias cuando:

1. Se crea un cambio con abono inicial (estado PENDIENTE)
2. El saldo se actualiza inmediatamente
3. Cuando se completa el cambio, el saldo NO se vuelve a actualizar
4. Resultado: El balance incluye transacciones que aún no están completadas

---

## 🔄 Flujo 1: Cambio de Divisa (CambioDivisa)

### 📍 Endpoint: `POST /api/exchanges`

**Archivo:** `/server/routes/exchanges.ts` (líneas 237-950)

### 🎯 Comportamiento Actual

#### Creación de Cambio (líneas 571-900)

```typescript
// 1. Se crea el cambio con estado según saldo_pendiente
const cambio = await tx.cambioDivisa.create({
  data: {
    estado:
      num(saldo_pendiente) > 0
        ? EstadoTransaccion.PENDIENTE // ⚠️ Si hay abono inicial
        : EstadoTransaccion.COMPLETADO, // ✅ Si es pago completo
    // ... otros campos
  },
});

// 2. ⚠️ PROBLEMA: Se actualiza el saldo INMEDIATAMENTE sin importar el estado
// Líneas 717-784: Actualiza saldo ORIGEN (ingreso)
await upsertSaldoEfectivoYBancos(tx, punto_atencion_id, moneda_origen_id, {
  cantidad: origenNuevoEf,
  billetes: origenNuevoBil,
  monedas_fisicas: origenNuevoMon,
  bancos: origenNuevoBk,
});

// Líneas 787-886: Actualiza saldo DESTINO (egreso)
await upsertSaldoEfectivoYBancos(tx, punto_atencion_id, moneda_destino_id, {
  cantidad: destinoNuevoEf,
  billetes: destinoNuevoBil,
  monedas_fisicas: destinoNuevoMon,
  bancos: destinoNuevoBk,
});
```

**❌ PROBLEMA:** El saldo se actualiza incluso cuando `estado = PENDIENTE`

---

### 📍 Endpoint: `PATCH /api/exchanges/:id/cerrar`

**Archivo:** `/server/routes/exchanges.ts` (líneas 1140-1234)

#### Completar Cambio Pendiente

```typescript
// Solo actualiza el estado, NO actualiza saldos
const updated = await prisma.cambioDivisa.update({
  where: { id },
  data: {
    estado: EstadoTransaccion.COMPLETADO,
    numero_recibo_completar: numeroReciboCierre,
    fecha_completado: new Date(),
  },
});
```

**❌ PROBLEMA:** Cuando se completa un cambio pendiente, NO se actualiza el saldo

---

### 🐛 Escenario del Bug

```
1. Cliente hace abono inicial de $500 USD de un total de $1000 USD
   ├─ Se crea CambioDivisa con estado = PENDIENTE
   ├─ monto_destino = 1000 USD
   ├─ abono_inicial_monto = 500 USD
   ├─ saldo_pendiente = 500 USD
   └─ ⚠️ El saldo se RESTA 1000 USD inmediatamente

2. Balance Dashboard muestra:
   └─ ❌ -1000 USD (incorrecto, debería ser 0 o -500)

3. Cliente completa el pago de los $500 restantes
   ├─ Se llama PATCH /api/exchanges/:id/cerrar
   ├─ estado cambia a COMPLETADO
   └─ ⚠️ El saldo NO se actualiza

4. Balance Dashboard sigue mostrando:
   └─ ❌ -1000 USD (incorrecto, ahora sí debería ser -1000)
```

---

## 🔄 Flujo 2: Transferencias (Transferencia)

### 📍 Endpoint: `POST /api/transfers`

**Archivo:** `/server/routes/transfers.ts` → `/server/controllers/transferController.ts`

### ✅ Comportamiento Correcto

#### Creación de Transferencia (líneas 105-117)

```typescript
const newTransfer = await transferCreationService.createTransfer({
  origen_id: origen_id || null,
  destino_id,
  moneda_id,
  monto,
  tipo_transferencia,
  solicitado_por: req.user.id,
  estado: "PENDIENTE", // ✅ Siempre se crea como PENDIENTE
  // ... otros campos
});

// ✅ CORRECTO: NO se actualiza el saldo al crear
// Líneas 119-128: Comentario explica que NO se contabiliza al crear
```

---

### 📍 Endpoint: `PATCH /api/transfer-approvals/:transferId/approve`

**Archivo:** `/server/routes/transfer-approvals.ts` (líneas 108-350)

#### Aprobación de Transferencia

```typescript
const updatedTransfer = await prisma.$transaction(async (tx) => {
  // 1. Actualizar estado
  const transferAprobada = await tx.transferencia.update({
    where: { id: transferId },
    data: {
      estado: "APROBADO",  // ✅ Cambia a APROBADO
      aprobado_por: req.user?.id,
      fecha_aprobacion: new Date(),
    }
  });

  // 2. ✅ CORRECTO: Actualizar saldo ORIGEN (si existe)
  if (transfer.origen_id) {
    const saldoNuevoOrigen = saldoAnteriorOrigen - Number(transfer.monto);
    await tx.saldo.upsert({
      where: { punto_atencion_id_moneda_id: { ... } },
      update: { cantidad: saldoNuevoOrigen }
    });
  }

  // 3. ✅ CORRECTO: Actualizar saldo DESTINO
  const saldoNuevoDestino = saldoAnteriorDestino + Number(transfer.monto);
  await tx.saldo.upsert({
    where: { punto_atencion_id_moneda_id: { ... } },
    update: { cantidad: saldoNuevoDestino }
  });
});
```

**✅ CORRECTO:** Los saldos solo se actualizan cuando la transferencia es APROBADA

---

## 🔄 Flujo 3: Servicios Externos (ServicioExternoMovimiento)

### 📍 Endpoint: `POST /api/servicios-externos`

**Archivo:** `/server/routes/servicios-externos.ts`

### ✅ Comportamiento Correcto

```typescript
// Los servicios externos NO tienen estado
// Se contabilizan inmediatamente al crear
const movimiento = await tx.servicioExternoMovimiento.create({
  data: {
    tipo_movimiento: "INGRESO" | "EGRESO",  // ✅ Sin estado
    monto,
    // ... otros campos
  }
});

// ✅ CORRECTO: Actualiza saldo inmediatamente
await tx.saldo.upsert({
  where: { punto_atencion_id_moneda_id: { ... } },
  update: { cantidad: nuevoSaldo }
});
```

**✅ CORRECTO:** Los servicios externos no tienen estados pendientes, se contabilizan inmediatamente

---

## 📊 Comparación de Flujos

| Tipo Transacción    | Estado al Crear        | ¿Actualiza Saldo al Crear? | ¿Actualiza Saldo al Aprobar/Completar? | Estado          |
| ------------------- | ---------------------- | -------------------------- | -------------------------------------- | --------------- |
| **CambioDivisa**    | PENDIENTE o COMPLETADO | ❌ SÍ (incorrecto)         | ❌ NO (incorrecto)                     | 🔴 **CRÍTICO**  |
| **Transferencia**   | PENDIENTE              | ✅ NO                      | ✅ SÍ (al aprobar)                     | ✅ **CORRECTO** |
| **ServicioExterno** | (sin estado)           | ✅ SÍ                      | N/A                                    | ✅ **CORRECTO** |

---

## 🔧 Solución Propuesta

### Opción 1: Seguir el Patrón de Transferencias (RECOMENDADO)

Modificar el flujo de CambioDivisa para que funcione como Transferencias:

```typescript
// EN: POST /api/exchanges (crear cambio)
const cambio = await tx.cambioDivisa.create({
  data: {
    estado: num(saldo_pendiente) > 0
      ? EstadoTransaccion.PENDIENTE
      : EstadoTransaccion.COMPLETADO,
    // ... otros campos
  }
});

// ✅ NUEVO: Solo actualizar saldo si estado = COMPLETADO
if (cambio.estado === EstadoTransaccion.COMPLETADO) {
  // Actualizar saldo ORIGEN
  await upsertSaldoEfectivoYBancos(tx, punto_atencion_id, moneda_origen_id, {...});

  // Actualizar saldo DESTINO
  await upsertSaldoEfectivoYBancos(tx, punto_atencion_id, moneda_destino_id, {...});

  // Registrar movimientos
  await logMovimientoSaldo(tx, {...});
}
```

```typescript
// EN: PATCH /api/exchanges/:id/cerrar (completar cambio)
const updated = await prisma.$transaction(async (tx) => {
  // 1. Actualizar estado
  const cambio = await tx.cambioDivisa.update({
    where: { id },
    data: {
      estado: EstadoTransaccion.COMPLETADO,
      numero_recibo_completar: numeroReciboCierre,
      fecha_completado: new Date(),
    }
  });

  // 2. ✅ NUEVO: Actualizar saldos al completar
  // Obtener datos del cambio
  const cambioCompleto = await tx.cambioDivisa.findUnique({
    where: { id },
    include: { monedaOrigen: true, monedaDestino: true }
  });

  // Actualizar saldo ORIGEN (ingreso)
  const saldoOrigen = await getSaldo(tx, cambio.punto_atencion_id, cambio.moneda_origen_id);
  const origenNuevo = Number(saldoOrigen?.cantidad || 0) + Number(cambio.monto_origen);
  await upsertSaldoEfectivoYBancos(tx, cambio.punto_atencion_id, cambio.moneda_origen_id, {
    cantidad: origenNuevo
  });

  // Actualizar saldo DESTINO (egreso)
  const saldoDestino = await getSaldo(tx, cambio.punto_atencion_id, cambio.moneda_destino_id);
  const destinoNuevo = Number(saldoDestino?.cantidad || 0) - Number(cambio.monto_destino);
  await upsertSaldoEfectivoYBancos(tx, cambio.punto_atencion_id, cambio.moneda_destino_id, {
    cantidad: destinoNuevo
  });

  // Registrar movimientos
  await logMovimientoSaldo(tx, {...});

  return cambio;
});
```

---

### Opción 2: Actualizar Saldo Parcial con Abono Inicial

Si se desea que el abono inicial afecte el saldo inmediatamente:

```typescript
// EN: POST /api/exchanges (crear cambio)
if (cambio.estado === EstadoTransaccion.COMPLETADO) {
  // Actualizar con monto completo
  await actualizarSaldo(monto_origen, monto_destino);
} else if (
  cambio.estado === EstadoTransaccion.PENDIENTE &&
  abono_inicial_monto > 0
) {
  // ✅ Actualizar solo con el abono inicial
  const porcentajeAbono = abono_inicial_monto / monto_destino;
  const montoOrigenAbono = monto_origen * porcentajeAbono;
  await actualizarSaldo(montoOrigenAbono, abono_inicial_monto);
}
```

```typescript
// EN: PATCH /api/exchanges/:id/cerrar (completar cambio)
// ✅ Actualizar con el saldo pendiente restante
const montoOrigenRestante = cambio.monto_origen - montoOrigenAbono;
const montoDestinoRestante = cambio.saldo_pendiente;
await actualizarSaldo(montoOrigenRestante, montoDestinoRestante);
```

---

## 📍 Archivos a Modificar

### 1. `/server/routes/exchanges.ts`

**Función:** `POST /` (crear cambio) - Línea 237

**Cambios:**

- Agregar condicional para solo actualizar saldo si `estado === COMPLETADO`
- Envolver actualización de saldos en `if (cambio.estado === EstadoTransaccion.COMPLETADO)`

**Función:** `PATCH /:id/cerrar` (completar cambio) - Línea 1140

**Cambios:**

- Agregar lógica de actualización de saldos dentro de la transacción
- Calcular y aplicar el saldo restante (monto_destino - abono_inicial_monto)

**Función:** `PATCH /:id/completar` (completar con método de entrega) - Línea 1238

**Cambios:**

- Similar a `/cerrar`, agregar actualización de saldos

---

## 🧪 Casos de Prueba

### Caso 1: Cambio Completo (sin abono)

```
1. Crear cambio: monto_destino = 1000 USD, saldo_pendiente = 0
   ✅ estado = COMPLETADO
   ✅ Saldo se actualiza: -1000 USD

2. Balance Dashboard:
   ✅ Muestra -1000 USD correctamente
```

### Caso 2: Cambio con Abono Inicial (Opción 1)

```
1. Crear cambio: monto_destino = 1000 USD, abono_inicial = 500 USD
   ✅ estado = PENDIENTE
   ✅ Saldo NO se actualiza: 0 USD

2. Balance Dashboard:
   ✅ Muestra 0 USD (transacción pendiente no se cuenta)

3. Completar cambio: saldo_pendiente = 500 USD
   ✅ estado = COMPLETADO
   ✅ Saldo se actualiza: -1000 USD

4. Balance Dashboard:
   ✅ Muestra -1000 USD correctamente
```

### Caso 3: Cambio con Abono Inicial (Opción 2)

```
1. Crear cambio: monto_destino = 1000 USD, abono_inicial = 500 USD
   ✅ estado = PENDIENTE
   ✅ Saldo se actualiza parcialmente: -500 USD

2. Balance Dashboard:
   ✅ Muestra -500 USD (abono inicial contabilizado)

3. Completar cambio: saldo_pendiente = 500 USD
   ✅ estado = COMPLETADO
   ✅ Saldo se actualiza con restante: -1000 USD total

4. Balance Dashboard:
   ✅ Muestra -1000 USD correctamente
```

---

## 📊 Impacto en el Balance Dashboard

### Endpoint: `GET /api/balance-completo/punto/:pointId`

**Archivo:** `/server/routes/balance-completo.ts`

**Filtros Actuales (CORRECTOS):**

```typescript
// Cambios de divisa - Solo COMPLETADOS
const cambiosDivisas = await prisma.cambioDivisa.findMany({
  where: {
    punto_atencion_id: pointId,
    estado: "COMPLETADO", // ✅ Correcto
  },
});

// Transferencias - Solo APROBADAS
const transferencias = await prisma.transferencia.findMany({
  where: {
    OR: [{ origen_id: pointId }, { destino_id: pointId }],
    estado: "APROBADO", // ✅ Correcto
  },
});

// Servicios externos - Todos (sin estado)
const serviciosExternos = await prisma.servicioExternoMovimiento.findMany({
  where: {
    punto_atencion_id: pointId,
    // ✅ Sin filtro de estado (correcto)
  },
});
```

**Problema Actual:**

- El endpoint filtra correctamente (solo COMPLETADOS y APROBADOS)
- Pero la tabla `Saldo` contiene valores incorrectos porque incluye transacciones PENDIENTES
- Resultado: Inconsistencia entre el balance calculado y el saldo en DB

**Solución:**

- Corregir la actualización de saldos en `exchanges.ts`
- Ejecutar script de recálculo para corregir datos históricos
- A partir de ese momento, `Saldo` y balance calculado coincidirán

---

## ✅ Checklist de Implementación

### Fase 1: Análisis y Planificación

- [x] Identificar el problema en el flujo de CambioDivisa
- [x] Documentar comportamiento actual vs esperado
- [x] Comparar con flujo de Transferencias (correcto)
- [ ] Decidir entre Opción 1 (recomendada) u Opción 2
- [ ] Revisar con el equipo de negocio el comportamiento esperado

### Fase 2: Implementación

- [ ] Modificar `POST /api/exchanges` para condicionar actualización de saldo
- [ ] Modificar `PATCH /api/exchanges/:id/cerrar` para actualizar saldo al completar
- [ ] Modificar `PATCH /api/exchanges/:id/completar` para actualizar saldo al completar
- [ ] Agregar tests unitarios para los nuevos flujos
- [ ] Agregar tests de integración para casos de abono inicial

### Fase 3: Corrección de Datos

- [ ] Ejecutar script de recálculo: `npx tsx server/scripts/recalcularYLimpiarDB.ts`
- [ ] Verificar que los saldos en DB coincidan con el balance calculado
- [ ] Comparar con registros contables manuales

### Fase 4: Validación

- [ ] Probar creación de cambio completo (sin abono)
- [ ] Probar creación de cambio con abono inicial
- [ ] Probar completar cambio pendiente
- [ ] Verificar Balance Dashboard muestra datos correctos
- [ ] Verificar que no hay errores en consola del navegador

### Fase 5: Despliegue

- [ ] Compilar proyecto: `npm run build`
- [ ] Desplegar en ambiente de staging
- [ ] Pruebas de aceptación con usuarios
- [ ] Desplegar en producción
- [ ] Monitorear logs por 24-48 horas

---

## 🎯 Recomendación Final

**Implementar Opción 1** (seguir patrón de Transferencias):

**Ventajas:**

- ✅ Consistencia con el flujo de Transferencias
- ✅ Más simple de implementar y mantener
- ✅ Evita complejidad de cálculos parciales
- ✅ Más fácil de auditar (transacción completa = saldo actualizado)
- ✅ Coincide con el filtro del endpoint de balance (solo COMPLETADOS)

**Desventajas:**

- ⚠️ El abono inicial no se refleja en el balance hasta completar
- ⚠️ Puede causar confusión si el usuario espera ver el abono inmediatamente

**Mitigación:**

- Agregar indicador visual en el dashboard de "Transacciones Pendientes"
- Mostrar monto total de abonos iniciales pendientes de completar
- Agregar reporte de "Cambios Pendientes" con detalle de abonos

---

**Fecha de Análisis:** 2025-01-08  
**Versión:** 1.0  
**Autor:** Sistema de Análisis de Código
