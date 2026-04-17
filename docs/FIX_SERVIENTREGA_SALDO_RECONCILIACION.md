# Fix: Saldo Servientrega No Se Descontaba al Generar Guías

**Fecha:** 17 de abril 2026  
**Punto afectado:** CC EL BOSQUE (`3f13bb4e-181b-4026-b1bf-4ae00f1d1391`)  
**Estado:** ✅ Resuelto

---

## 🚨 Problema Reportado

El operador del punto CC EL BOSQUE reportó:

1. **"Al generar la guía da error, pero la guía sí se genera"**
2. **"El valor de las guías generadas no se reduce"**
3. **"El saldo de Servientrega no está correcto porque no se reduce el saldo de las guías que se han estado generando por el error que se reporta"**

---

## 🔍 Causa Raíz

El flujo de generación de guías en `server/routes/servientrega/shipping.ts` NO era atómico:

```
1. Generar guía en Servientrega API ✅
2. Guardar guía en BD local ✅
3. Descontar saldo de Servientrega ❌ (podía fallar)
4. Registrar ingreso en caja general ❌ (podía fallar)
```

Si el servidor se reiniciaba, crasheaba o había un timeout entre el paso 2 y 3:
- La guía quedaba guardada en la BD local
- La guía existía en Servientrega
- **PERO el saldo NO se descontaba**

Esto dejaba el saldo de Servientrega inconsistente: guías generadas pero sin descuento.

### Evidencia Encontrada

- **14 guías** en CC EL BOSQUE sin movimiento de EGRESO
- **$90.27** no descontados del saldo
- El patrón temporal mostraba un "gap" de ~2 días donde las guías no generaron movimientos

---

## ✅ Solución Aplicada

### 1. Transacción Atómica en el Endpoint

**Archivo:** `server/routes/servientrega/shipping.ts`

Ahora todo el flujo post-API (guardar guía + descontar saldo + registrar ingreso) está envuelto en una sola transacción de Prisma:

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Guardar guía
  await db.guardarGuia(guiaData, tx);
  
  // 2. Descontar saldo
  await db.descontarSaldo(puntoId, monto, guia, tx);
  
  // 3. Registrar ingreso
  await db.registrarIngresoServicioExterno(puntoId, monto, guia, ..., tx);
}, { maxWait: 10000, timeout: 30000 });
```

Si cualquier paso falla, **toda la transacción se revierte** y la guía NO queda guardada sin saldo descontado.

### 2. Refactorización de Servicios para Aceptar Transacción Externa

**Archivo:** `server/services/servientregaDBService.ts`

Los métodos ahora aceptan un `Prisma.TransactionClient` opcional:

- `guardarGuia(data, tx?)`
- `descontarSaldo(puntoId, monto, guia, tx?)`
- `registrarIngresoServicioExterno(puntoId, monto, guia, ..., tx?)`

Si se pasa `tx`, usan la transacción externa. Si no, crean su propia transacción.

### 3. Campo `saldo_descontado` en ServientregaGuia

**Archivo:** `prisma/schema.prisma`

Nuevo campo para trazabilidad:
```prisma
model ServientregaGuia {
  // ... campos existentes ...
  saldo_descontado  Boolean  @default(false)
}
```

### 4. Preservar `valor_total` del Frontend en Payload

**Archivo:** `server/routes/servientrega/shipping.ts`

Cuando el frontend envía el payload ya formateado (`tipo: "GeneracionGuia"`), ahora se preservan los campos de costo (`valor_total`, `gtotal`, `total_transacion`, `flete`, etc.) en el payload. Esto asegura que si Servientrega no devuelve los costos en la respuesta, el backend pueda usar el valor enviado por el frontend.

### 5. Script de Reconciliación

**Archivo:** `scripts/reconciliar-saldo-servientrega.ts`

Script para corregir saldos históricos. Encuentra guías sin movimiento de EGRESO y:
1. Descuenta el saldo
2. Crea los movimientos faltantes
3. Marca la guía como `saldo_descontado = true`

**Uso:**
```bash
npx tsx scripts/reconciliar-saldo-servientrega.ts <punto_atencion_id>
```

---

## 📊 Resultados de la Reconciliación

**Punto:** CC EL BOSQUE

| Métrica | Valor |
|---------|-------|
| Guías procesadas | 14 |
| Total reconciliado | $90.27 |
| Saldo antes | $200.25 |
| Saldo después | $109.98 |

---

## 🔄 Próximos Pasos

1. **Monitorear** que las nuevas guías generen correctamente los movimientos de EGRESO e INGRESO
2. **Verificar** que el saldo se descuente correctamente en tiempo real
3. **Ejecutar** el script de reconciliación periódicamente o crear un job automático
4. **Considerar** agregar una UI de administración para ver guías con `saldo_descontado = false`

---

## 🐛 Bug Adicional Corregido

### Pago por BANCO no actualizaba `Saldo.bancos`

Durante la revisión del código se descubrió que cuando el pago era por transferencia bancaria (`metodo_ingreso = "BANCO"` o `"MIXTO"`), el sistema registraba el `MovimientoSaldo` pero **no actualizaba el campo `bancos` en la tabla `Saldo`**. Esto causaba discrepancias en el cuadre de caja.

**Fix aplicado en:** `server/services/servientregaDBService.ts`

---

## 📝 Archivos Modificados

- `server/routes/servientrega/shipping.ts` — Transacción atómica, preservar valor_total
- `server/services/servientregaDBService.ts` — Refactorización para tx externa + fix bancos
- `prisma/schema.prisma` — Campo `saldo_descontado`
- `scripts/reconciliar-saldo-servientrega.ts` — Nuevo script de reconciliación
- `docs/FLUJO_CONTABLE_SERVIENTREGA.md` — Documentación completa del flujo contable
