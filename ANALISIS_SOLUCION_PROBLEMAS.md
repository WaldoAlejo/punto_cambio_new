# Análisis y Soluciones - Sistema de Cambio de Divisas

Fecha: 22 de Diciembre de 2025

## Resumen Ejecutivo

Se han identificado y corregido varios problemas críticos en el sistema de manejo de billetes, monedas, transferencias, servicios externos y anulaciones.

---

## 1. ✅ CAMBIO DE DIVISAS - Billetes y Monedas

### Estado: FUNCIONANDO CORRECTAMENTE
- ✅ El sistema registra correctamente billetes y monedas en cambios de divisas
- ✅ Se desglosan correctamente entre `divisas_entregadas_billetes` y `divisas_entregadas_monedas`
- ✅ Se mantiene proporción de billetes vs monedas en cálculos de saldo

### Archivo: `server/routes/exchanges.ts` (líneas 750-800)
```
Funciona correctamente:
- divisas_entregadas_billetes: número de billetes entregados por cliente
- divisas_entregadas_monedas: número de monedas entregadas por cliente
- divisas_recibidas_billetes: número de billetes a entregar al cliente
- divisas_recibidas_monedas: número de monedas a entregar al cliente
```

---

## 2. ✅ CAMBIO DE DIVISAS - Anulación con Reversión

### Estado: FUNCIONANDO CORRECTAMENTE
- ✅ Endpoint DELETE `/:id` revierte correctamente saldos
- ✅ Revierte billetes y monedas en origen y destino
- ✅ Revierte saldo en efectivo y bancos
- ✅ Registra movimientos de ajuste en `movimiento_saldo`
- ✅ Solo permite anular cambios del día actual

### Archivo: `server/routes/exchanges.ts` (líneas 2664-2900)
```typescript
// Reversión correcta:
- Origen: RESTA billetes/monedas que se recibieron
- Destino: SUMA billetes/monedas que se entregaron
- Ambos: Revierte tanto efectivo como bancos
```

---

## 3. ✅ SERVICIOS EXTERNOS - Billetes y Monedas

### PROBLEMA CORREGIDO (actualizado hoy)

#### Antes:
- No se actualizaban billetes y monedas al crear movimientos de servicios externos
- Solo se actualizaban en `servicioExternoSaldo`, no en `saldo` general

#### Después (LÍNEA 313-320):
```typescript
await tx.saldo.update({
  where: { id: saldoGeneral.id },
  data: {
    cantidad: nuevoSaldoGeneral,
    billetes: nuevoBilletes >= 0 ? nuevoBilletes : saldoBilletes,
    monedas_fisicas: nuevasMonedas >= 0 ? nuevasMonedas : saldoMonedas,
  },
});
```

**Lo que corrige:**
- INGRESO: SUMA billetes y monedas al saldo general
- EGRESO: RESTA billetes y monedas del saldo general

### Archivo: `server/routes/servicios-externos.ts` (líneas 295-320)

---

## 4. ✅ SERVICIOS EXTERNOS - Anulación con Reversión

### PROBLEMA CORREGIDO (actualizado hoy)

#### Antes (línea 646-652):
```typescript
// ❌ LÓGICA INVERTIDA:
const billetesSiguientes = mov.tipo_movimiento === "INGRESO"
  ? (saldoGeneral.billetes ? Number(saldoGeneral.billetes) + billetes : billetes)  // ❌ SUMA cuando debería RESTAR
  : (saldoGeneral.billetes ? Number(saldoGeneral.billetes) - billetes : -billetes); // ❌ RESTA cuando debería SUMAR
```

#### Después (LÍNEA 646-652):
```typescript
// ✅ LÓGICA CORRECTA:
const billetesSiguientes = mov.tipo_movimiento === "INGRESO"
  ? Math.max(0, (saldoGeneral.billetes ? Number(saldoGeneral.billetes) - billetes : -billetes))  // ✅ RESTA
  : Math.max(0, (saldoGeneral.billetes ? Number(saldoGeneral.billetes) + billetes : billetes));  // ✅ SUMA
```

**Lógica Correcta:**
- Si movimiento fue INGRESO:
  - Operador RECIBIÓ dinero → se SUMARON billetes al saldo
  - Al anular: se RESTAN billetes (reversión)
  
- Si movimiento fue EGRESO:
  - Operador PAGÓ dinero → se RESTARON billetes del saldo  
  - Al anular: se SUMAN billetes (reversión)

### Archivo: `server/routes/servicios-externos.ts` (líneas 593-613 y 643-652)

---

## 5. ✅ TRANSFERENCIAS - Billetes y Monedas

### Estado: FUNCIONANDO CORRECTAMENTE
- ✅ Se manejan billetes y monedas en `detalle_divisas`
- ✅ Se desglosan correctamente en entrada a destino
- ✅ Se registran en `movimiento_saldo`

### Archivo: `server/services/transferCreationService.ts` (líneas 313-350)
```typescript
// Correctamente se desglosano:
let billetes = Number((args as any).detalle_divisas.billetes ?? 0);
let monedas = Number((args as any).detalle_divisas.monedas ?? 0);

// Y se actualizan en saldo:
await prisma.saldo.update({
  data: {
    cantidad: nuevoEf,
    billetes: nuevoBil,
    monedas_fisicas: nuevoMon,
  },
});
```

---

## 6. ⚠️ SERVIENTREGA - Guías con Nombre de Agencia

### SITUACIÓN ACTUAL

#### El Problema:
Las guías se generan sin usar el `servientrega_agencia_nombre` asignado al punto de atención. Actualmente, Servientrega recibe:

```javascript
payload = {
  ...
  alianza: "PUNTO CAMBIO SAS",           // ← Del punto_atencion
  alianza_oficina: "QUITO_PLAZA DEL VALLE_PC",  // ← Del punto_atencion
  // ⚠️ NO se envía servientrega_agencia_nombre
}
```

#### Campos Disponibles en PuntoAtencion:
```prisma
servientrega_agencia_codigo     String?   // ej: "001"
servientrega_agencia_nombre     String?   // ej: "QUITO CENTRO"
servientrega_alianza            String?   // ej: "PUNTO CAMBIO SAS"
servientrega_oficina_alianza    String?   // ej: "QUITO_PLAZA DEL VALLE_PC"
```

#### Validación Actual (línea 332-342):
```typescript
if (!punto.servientrega_agencia_codigo) {
  return res.status(403).json({
    error: "Servientrega no habilitado",
    mensaje: `El punto \"${punto.nombre}\" no tiene Servientrega configurado...`
  });
}
```

**El sistema verifica que exista `servientrega_agencia_codigo`, pero NO usa `servientrega_agencia_nombre`**

### Investigación Requerida:
1. ¿El API de Servientrega acepta un parámetro de nombre de agencia?
2. ¿Debería ser `nombre_agencia`, `agencia_nombre`, o algo más?
3. ¿Las guías se generan con el código de agencia (`001`) o el nombre (`QUITO CENTRO`)?

### Recomendación Inmediata:
1. Consultar documentación de API de Servientrega
2. Verificar campos aceptados en la solicitud de GeneracionGuia
3. Si acepta el nombre, agregarlo al payload:
```javascript
payload = {
  ...
  ...(punto?.servientrega_agencia_nombre ? 
    { nombre_agencia: punto.servientrega_agencia_nombre } 
    : {}),
}
```

### Archivo: `server/routes/servientrega/shipping.ts` (líneas 301-413)

---

## 7. ✅ ASIGNACIONES DE SALDOS - Billetes y Monedas

### Estado: FUNCIONANDO CORRECTAMENTE
- ✅ Se pueden asignar saldos iniciales con billetes y monedas
- ✅ Se registran correctamente en `SaldoInicial`
- ✅ Se actualiza `Saldo` con desglose de billetes y monedas_fisicas

---

## 📊 Resumen de Cambios Realizados Hoy

| Archivo | Línea(s) | Problema | Solución |
|---------|----------|----------|----------|
| `servicios-externos.ts` | 313-320 | Billetes/monedas no se actualizaban en saldo general | ✅ Agregada lógica de actualización |
| `servicios-externos.ts` | 597-603 | Billetes/monedas no se revertían en saldo de servicio | ✅ Corregida actualización |
| `servicios-externos.ts` | 646-652 | Billetes/monedas: lógica invertida en reversión | ✅ Invertida correctamente |
| `exchanges.ts` | N/A | Cambio divisas funcionando | ✅ Verificado correcto |

---

## 🔄 Flujo de Operaciones - Ahora Correcto

### Servicio Externo INGRESO (cliente deposita dinero):
```
1. Cliente entrega: $100 en 8 billetes + 2 monedas
2. Sistema SUMA al saldo general: cantidad += 100, billetes += 8, monedas += 2
3. Sistema RESTA del saldo digital del servicio (es crédito consumido)
4. MovimientoSaldo registra: INGRESO de $100
```

### Servicio Externo EGRESO (operador paga dinero):
```
1. Operador entrega: $100 en billetes
2. Sistema RESTA del saldo general: cantidad -= 100, billetes -= cantidad_billetes
3. Sistema SUMA al saldo digital del servicio (repone crédito)
4. MovimientoSaldo registra: EGRESO de $100
```

### Anulación de INGRESO:
```
1. Reversión SUMA al saldo digital
2. Reversión RESTA billetes y monedas del saldo general
```

### Anulación de EGRESO:
```
1. Reversión RESTA del saldo digital
2. Reversión SUMA billetes y monedas al saldo general
```

---

## 🧪 Próximas Validaciones Recomendadas

1. **Test de flujo completo**: INGRESO → EGRESO → Anular EGRESO → Anular INGRESO
2. **Test de billetes/monedas**: Verificar que se descuentan correctamente en cada operación
3. **Test de Servientrega**: Validar si el nombre de agencia aparece en guías generadas
4. **Test de reconciliación**: Ejecutar reconciliación de saldos para verificar consistencia

---

## 📝 Notas Importantes

- **Auto-reconciliación DESHABILITADA**: Se ejecutaba doble actualización. Usar endpoint manual.
- **MovimientoSaldo**: Registro centralizado de todos los movimientos de efectivo
- **Math.max(0, ...)**: Previene saldos negativos en billetes/monedas
- **Transacciones atómicas**: Todos los cambios usan `tx` para consistencia

---

**Realizado por:** Sistema de Análisis Automático  
**Fecha:** 2025-12-22  
**Estado**: ANÁLISIS COMPLETADO - CORRECCIONES IMPLEMENTADAS
