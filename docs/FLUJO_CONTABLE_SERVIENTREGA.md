# Flujo Contable de Servientrega

**Documento de referencia para desarrollo y troubleshooting**  
**Última actualización:** 17 de abril 2026

---

## 📋 Visión General del Negocio

Servientrega es un **servicio externo** que opera dentro del ecosistema de Punto Cambio. El flujo contable es **bidireccional** y conecta dos mundos:

1. **Saldo de Servientrega** (crédito digital del punto para generar guías)
2. **Saldo de Caja General USD** (efectivo que el cliente paga por el envío)

> ⚠️ **REGLA DE ORO:** Cada vez que se genera una guía Servientrega, hay DOS movimientos contables:
> - **EGRESO** del crédito Servientrega (se gasta el crédito)
> - **INGRESO** a la caja general USD (el cliente paga en efectivo)

---

## 💰 Flujo Contable al Generar una Guía

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CLIENTE: Paga $5.92 en efectivo por el envío                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PUNTO CAMBIO: Recibe $5.92 en efectivo                                     │
│  ─────────────────────────────────────                                      │
│  1. EGRESO de ServientregaSaldo: -$5.92 (se usa el crédito digital)         │
│     → Tabla: ServicioExternoSaldo (campo: cantidad)                         │
│     → Movimiento: ServicioExternoMovimiento (tipo: EGRESO)                  │
│                                                                               │
│  2. INGRESO a Saldo General USD: +$5.92 (el efectivo entra a caja)          │
│     → Tabla: Saldo (campo: cantidad, billetes)                              │
│     → Movimiento: MovimientoSaldo (tipo: INGRESO, bucket: CAJA)             │
│                                                                               │
│  3. INGRESO de auditoría ServicioExterno: +$5.92                            │
│     → Tabla: ServicioExternoMovimiento (tipo: INGRESO)                      │
│     → Nota: Este es SOLO para auditoría, NO modifica el saldo de Servientrega│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗃️ Tablas Involucradas

### 1. ServicioExternoSaldo (Crédito Digital Servientrega)

```prisma
model ServicioExternoSaldo {
  id                String
  punto_atencion_id String
  servicio          ServicioExterno  // SERVIENTREGA
  moneda_id         String           // USD
  cantidad          Decimal          // Saldo total disponible
  billetes          Decimal          // Desglose físico
  monedas_fisicas   Decimal
  bancos            Decimal          // No aplica para Servientrega (usualmente 0)
}
```

**Cómo se actualiza:**
- **Recarga de saldo:** `cantidad += monto`
- **Generación de guía:** `cantidad -= costo_envio`
- **Anulación mismo día:** `cantidad += costo_envio`

### 2. ServicioExternoMovimiento (Auditoría)

```prisma
model ServicioExternoMovimiento {
  id                String
  punto_atencion_id String
  servicio          ServicioExterno  // SERVIENTREGA
  tipo_movimiento   TipoMovimiento   // EGRESO o INGRESO
  moneda_id         String
  monto             Decimal
  numero_referencia String           // Número de guía
  descripcion       String
}
```

**Movimientos por guía generada:**

| # | Tipo | Descripción | Propósito |
|---|------|-------------|-----------|
| 1 | EGRESO | "Uso de crédito por generación de guía XXX" | Registrar que se gastó crédito Servientrega |
| 2 | INGRESO | "Ingreso por generación de guía Servientrega #XXX" | Registrar que el cliente pagó en efectivo |

> 🔑 **Clave:** El EGRESO descuenta del `ServicioExternoSaldo`. El INGRESO de auditoría NO modifica el saldo (es solo registro).

### 3. Saldo (Caja General del Punto)

```prisma
model Saldo {
  id                String
  punto_atencion_id String
  moneda_id         String
  cantidad          Decimal  // Total en caja (efectivo + bancos)
  billetes          Decimal
  monedas_fisicas   Decimal
  bancos            Decimal
}
```

**Cómo se actualiza al generar guía:**
- `cantidad += costo_envio` (el efectivo del cliente entra a caja)
- `billetes += costo_envio` (si es pago en efectivo)

### 4. MovimientoSaldo (Auditoría de Caja)

```prisma
model MovimientoSaldo {
  id              String
  punto_atencion_id String
  moneda_id       String
  tipo            TipoMovimiento  // INGRESO
  monto           Decimal
  saldo_anterior  Decimal
  saldo_nuevo     Decimal
  tipo_referencia TipoReferencia  // SERVIENTREGA
  referencia_id   String          // Número de guía
  saldo_bucket    String          // CAJA o BANCOS
}
```

---

## 🔄 Flujo Completo Paso a Paso

### Paso 1: Validación Previa
```typescript
// Middleware: validarSaldoGenerarGuia
// Verifica que ServicioExternoSaldo.cantidad >= valor_total
```

### Paso 2: Generación en Servientrega API
```typescript
// Llama a apiService.generarGuia(payload)
// Servientrega devuelve: guia, guia_64 (PDF), proceso
```

### Paso 3: Transacción Atómica Local
```typescript
await prisma.$transaction(async (tx) => {
  // 3a. Guardar guía en ServientregaGuia
  await db.guardarGuia(guiaData, tx);
  
  // 3b. Descontar crédito Servientrega
  await db.descontarSaldo(puntoId, monto, guia, tx);
  //    → UPDATE ServicioExternoSaldo SET cantidad = cantidad - monto
  //    → INSERT ServicioExternoMovimiento (EGRESO)
  //    → INSERT ServientregaHistorialSaldo (legacy)
  
  // 3c. Registrar ingreso en caja general
  await db.registrarIngresoServicioExterno(puntoId, monto, guia, ..., tx);
  //    → INSERT ServicioExternoMovimiento (INGRESO - auditoría)
  //    → INSERT MovimientoSaldo (INGRESO - caja)
  //    → UPSERT Saldo (cantidad += monto)
});
```

### Paso 4: Respuesta al Frontend
```typescript
return res.json({
  guia: "100085XXXX",
  guia_64: "...",
  valorTotalGuia: 5.92,
  costo_total: 5.92,
});
```

---

## 📊 Ejemplo Numérico

**Escenario:** Cliente envía un documento, costo $5.92

**Antes de la guía:**
| Concepto | Valor |
|----------|-------|
| ServicioExternoSaldo.cantidad | $200.00 |
| Saldo.cantidad (USD) | $1,500.00 |

**Después de la guía:**
| Concepto | Valor | Cambio |
|----------|-------|--------|
| ServicioExternoSaldo.cantidad | $194.08 | -$5.92 |
| Saldo.cantidad (USD) | $1,505.92 | +$5.92 |

**Movimientos creados:**
| Tabla | Tipo | Monto | Referencia |
|-------|------|-------|------------|
| ServicioExternoMovimiento | EGRESO | $5.92 | 100085XXXX |
| ServicioExternoMovimiento | INGRESO | $5.92 | 100085XXXX |
| MovimientoSaldo | INGRESO | $5.92 | 100085XXXX |
| ServientregaHistorialSaldo | - | -$5.92 | - |

---

## ⚠️ Casos Especiales

### Concesión
Si el usuario tiene rol `CONCESION`:
- ✅ Se descuenta el crédito Servientrega (EGRESO)
- ❌ NO se actualiza el saldo general USD (no hay ingreso a caja)
- La concesión maneja su propia caja

### Anulación Mismo Día
Si se anula una guía el mismo día:
- ✅ Se devuelve el crédito Servientrega (INGRESO a ServicioExternoSaldo)
- ✅ Se revierte el ingreso a caja general (EGRESO de Saldo)
- ✅ Se crean movimientos de reversión

### Anulación Día Siguiente
Si se anula al día siguiente:
- ❌ NO se devuelve el crédito Servientrega (ya se facturó)
- ✅ Se marca la guía como ANULADA
- ⚠️ El ingreso a caja general permanece (ya fue contabilizado)

---

## 🛠️ Troubleshooting

### Síntoma: "El saldo de Servientrega no baja"

**Posibles causas:**
1. `valorTotalGuia` se calculó como 0 (revisar logs)
2. La transacción atómica falló (revisar logs de error)
3. `punto_atencion_id_captado` es undefined
4. No existe registro en `ServicioExternoSaldo` para el punto

**Dónde revisar:**
```bash
# Ver guías sin movimiento EGRESO
SELECT g.numero_guia, g.costo_envio, g.created_at
FROM "ServientregaGuia" g
LEFT JOIN "ServicioExternoMovimiento" m 
  ON g.numero_guia = m.numero_referencia 
  AND m.servicio = 'SERVIENTREGA'
  AND m.tipo_movimiento = 'EGRESO'
WHERE g.punto_atencion_id = '<PUNTO_ID>'
AND g.estado = 'ACTIVA'
AND m.numero_referencia IS NULL;
```

### Síntoma: "La caja general USD no cuadra"

**Posibles causas:**
1. `registrarIngresoServicioExterno` falló pero `descontarSaldo` funcionó
2. Hay movimientos manuales en `Saldo` que no están en `MovimientoSaldo`
3. Race condition entre operadores

**Dónde revisar:**
```bash
# Comparar Saldo.cantidad vs suma de MovimientoSaldo
SELECT 
  (SELECT cantidad FROM "Saldo" WHERE punto_atencion_id = '<PUNTO_ID>' AND moneda_id = '<USD_ID>') as saldo_tabla,
  (SELECT COALESCE(SUM(monto), 0) FROM "MovimientoSaldo" 
   WHERE punto_atencion_id = '<PUNTO_ID>' AND moneda_id = '<USD_ID>') as saldo_movimientos;
```

### Síntoma: "Hay guías generadas pero no aparecen en la lista"

**Posibles causas:**
1. El `punto_atencion_id` de la guía no coincide con el del operador
2. La guía se guardó sin `punto_atencion_id` (fallo en captura)
3. Filtro de fechas en el frontend

---

## 🔗 Archivos Clave

| Archivo | Responsabilidad |
|---------|-----------------|
| `server/routes/servientrega/shipping.ts` | Endpoint de generación/anulación |
| `server/services/servientregaDBService.ts` | Lógica de descuento e ingreso |
| `server/services/servientregaAPIService.ts` | Comunicación con API Servientrega |
| `server/routes/servientrega/balances.ts` | Consulta de saldos |
| `scripts/reconciliar-saldo-servientrega.ts` | Script de corrección histórica |

---

## 🐛 Bugs Corregidos

### Bug: Pago por BANCO no actualizaba `Saldo.bancos`

**Fecha corregido:** 17 de abril 2026  
**Archivo:** `server/services/servientregaDBService.ts`

**Problema:** Cuando el cliente pagaba con transferencia bancaria (`metodo_ingreso = "BANCO"` o `"MIXTO"`), el sistema:
- ✅ Registraba el `MovimientoSaldo` con `saldoBucket = "BANCOS"`
- ❌ **NO actualizaba** el campo `bancos` en la tabla `Saldo`

**Impacto:** El saldo de bancos en la tabla `Saldo` quedaba desactualizado, causando discrepancias en el cuadre de caja.

**Fix:** Agregar `transaction.saldo.upsert()` para actualizar el campo `bancos` cuando `desglose.bancos > 0`.

---

## 📌 Notas para Desarrolladores

1. **Siempre usar transacción atómica** para guardar guía + descontar saldo + registrar ingreso
2. **Nunca modificar `ServicioExternoSaldo` directamente** sin crear el `ServicioExternoMovimiento` correspondiente
3. **El `valorTotalGuia` debe ser > 0** para que se descuente saldo
4. **El `numero_referencia` en movimientos debe coincidir** con el `numero_guia` para facilitar trazabilidad
5. **Si se agrega un nuevo servicio externo**, seguir el mismo patrón: EGRESO del crédito + INGRESO a caja
6. **Siempre actualizar TODOS los campos del desglose** en `Saldo` (cantidad, billetes, monedas_fisicas, bancos)
