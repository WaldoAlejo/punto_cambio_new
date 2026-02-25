# 📊 Proceso de Ajuste Contable en el Cierre de Caja

## Resumen del Flujo

Cuando un operador cierra la caja y existe una diferencia entre el **saldo teórico** (calculado por el sistema) y el **conteo físico** (ingresado por el operador), el sistema realiza automáticamente un ajuste contable para cuadrar las cuentas.

---

## 🔄 Diagrama del Proceso

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CIERRE DE CAJA CON DIFERENCIA                     │
└─────────────────────────────────────────────────────────────────────┘

    [Saldo Teórico: $1,000]
    [Conteo Físico: $1,015]  → Diferencia: +$15 (SOBRANTE)
              ↓
    ┌─────────────────────────┐
    │  1. ACTUALIZAR SALDO    │
    │     Tabla: Saldo        │
    │     cantidad = $1,015   │
    └─────────────────────────┘
              ↓
    ┌─────────────────────────┐
    │  2. CREAR AJUSTE        │
    │     Tabla: MovimientoSaldo
    │     Tipo: INGRESO       │
    │     Monto: $15          │
    │     Descripción: "AJUSTE CIERRE 2025-01-15"
    └─────────────────────────┘
              ↓
    ✅ Sistema cuadrado
    ✅ Próximo día inicia con $1,015
    ✅ Ajuste trazable en historial
```

---

## 🔍 Código del Proceso

### Paso 1: Calcular la Diferencia

```typescript
// En: server/services/cierreUnificadoService.ts (líneas 317-319)

const diferencia = Number(
  (detalle.conteo_fisico - (detalle.saldo_cierre || 0)).toFixed(2)
);

// Ejemplo:
// conteo_fisico = 1015
// saldo_cierre  = 1000
// diferencia    = +15 (sobrante)
```

### Paso 2: Verificar si Hay Diferencia Significativa

```typescript
// Línea 321
if (Math.abs(diferencia) >= 0.01) {
  // Solo si la diferencia es >= 1 centavo
```

### Paso 3: Verificar que No Exista Ajuste Previo

```typescript
// Líneas 323-331
const yaExiste = await ejecutor.movimientoSaldo.findFirst({
  where: {
    punto_atencion_id: puntoAtencionId,
    moneda_id: detalle.moneda_id,
    tipo_referencia: TipoReferencia.CIERRE_DIARIO,
    referencia_id: cabecera.id,
    descripcion: { contains: "AJUSTE CIERRE", mode: "insensitive" },
  },
});

// Evita duplicar ajustes si se reintenta el cierre
```

### Paso 4: Crear el Movimiento de Ajuste

```typescript
// Líneas 334-352
await registrarMovimientoSaldo(
  {
    puntoAtencionId: puntoAtencionId,
    monedaId: detalle.moneda_id,
    tipoMovimiento: diferencia > 0 
      ? TipoMovimiento.INGRESO   // Si sobró dinero
      : TipoMovimiento.EGRESO,   // Si faltó dinero
    monto: Math.abs(diferencia),
    saldoAnterior: detalle.saldo_cierre || 0,
    saldoNuevo: detalle.conteo_fisico,
    tipoReferencia: TipoReferencia.CIERRE_DIARIO,
    referenciaId: cabecera.id,
    descripcion: `AJUSTE CIERRE ${new Date().toISOString().slice(0, 10)}`,
    usuarioId: usuarioId,
    saldoBucket: "CAJA",
  },
  ejecutor
);
```

### Paso 5: Actualizar la Tabla Saldo

```typescript
// Líneas 292-314
await ejecutor.saldo.upsert({
  where: {
    punto_atencion_id_moneda_id: {
      punto_atencion_id: puntoAtencionId,
      moneda_id: detalle.moneda_id,
    },
  },
  update: {
    cantidad: detalle.conteo_fisico,      // El valor físico contado
    billetes: detalle.billetes,            // Desglose de billetes
    monedas_fisicas: detalle.monedas,      // Desglose de monedas
    bancos: detalle.conteo_bancos || 0,    // Valor en bancos
    updated_at: new Date(),
  },
  create: {
    // Si no existe el registro, lo crea
    punto_atencion_id: puntoAtencionId,
    moneda_id: detalle.moneda_id,
    cantidad: detalle.conteo_fisico,
    billetes: detalle.billetes,
    monedas_fisicas: detalle.monedas,
    bancos: detalle.conteo_bancos || 0,
  },
});
```

---

## 📋 Ejemplos Prácticos

### Ejemplo 1: Sobrante de $15

```
Día: 15 de enero, 2025
Punto: Oficina Principal
Moneda: USD
Operador: Juan Pérez

┌────────────────────────────────┐
│        ANTES DEL CIERRE        │
├────────────────────────────────┤
│ Saldo Teórico:    $1,000.00   │
│ (según sistema)               │
└────────────────────────────────┘

Conteo Físico:
  - Billetes: $900.00
  - Monedas:  $115.00
  ─────────────────────
  - Total:   $1,015.00

DIFERENCIA: +$15.00 (SOBRANTE)

┌────────────────────────────────┐
│      ACCIONES DEL SISTEMA      │
├────────────────────────────────┤
│ ✅ Tabla Saldo:                 │
│    cantidad = $1,015.00        │
│    billetes = $900.00          │
│    monedas  = $115.00          │
│                                 │
│ ✅ MovimientoSaldo creado:     │
│    Tipo: INGRESO               │
│    Monto: $15.00               │
│    Descripción: "AJUSTE CIERRE │
│                 2025-01-15"    │
│    Saldo Anterior: $1,000.00   │
│    Saldo Nuevo: $1,015.00      │
└────────────────────────────────┘

Resultado: El sobrante de $15 queda registrado como un 
ingreso por ajuste, y el próximo día inicia con $1,015.
```

### Ejemplo 2: Faltante de $8.50

```
Día: 15 de enero, 2025
Punto: Sucursal Norte
Moneda: USD
Operador: María García

┌────────────────────────────────┐
│        ANTES DEL CIERRE        │
├────────────────────────────────┤
│ Saldo Teórico:    $2,500.00   │
│ (según sistema)               │
└────────────────────────────────┘

Conteo Físico:
  - Billetes: $2,400.00
  - Monedas:  $91.50
  ─────────────────────
  - Total:   $2,491.50

DIFERENCIA: -$8.50 (FALTANTE)

┌────────────────────────────────┐
│      ACCIONES DEL SISTEMA      │
├────────────────────────────────┤
│ ✅ Tabla Saldo:                 │
│    cantidad = $2,491.50        │
│    billetes = $2,400.00        │
│    monedas  = $91.50           │
│                                 │
│ ✅ MovimientoSaldo creado:     │
│    Tipo: EGRESO                │
│    Monto: $8.50                │
│    Descripción: "AJUSTE CIERRE │
│                 2025-01-15"    │
│    Saldo Anterior: $2,500.00   │
│    Saldo Nuevo: $2,491.50      │
└────────────────────────────────┘

Resultado: El faltante de $8.50 queda registrado como un 
egreso por ajuste, y el próximo día inicia con $2,491.50.
```

---

## 🎯 Lógica de Decisiones

```
┌─────────────────────────────────────────┐
│           INICIO DEL CIERRE            │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ ¿Diferencia >= $0.01?                   │
│ (1 centavo o más)                       │
└─────────────────────────────────────────┘
         │             │
         NO            │ SÍ
         │             │
         ▼             ▼
┌─────────────┐   ┌─────────────────────────┐
│ No crear    │   │ ¿Ya existe ajuste para  │
│ ajuste      │   │ este cuadre?            │
│ (cuadra     │   └─────────────────────────┘
│ perfecto)   │            │           │
└─────────────┘            SÍ          NO
                           │           │
                           ▼           ▼
                    ┌────────────┐  ┌──────────────────────────┐
                    │ No crear   │  │ Crear MovimientoSaldo    │
                    │ duplicado  │  │                          │
                    └────────────┘  │ Tipo: INGRESO si dif > 0 │
                                    │       EGRESO si dif < 0  │
                                    │ Monto: |diferencia|      │
                                    │ Ref: CIERRE_DIARIO       │
                                    └──────────────────────────┘
```

---

## 📊 Tablas Involucradas

### 1. Tabla `Saldo`
Se actualiza con el valor físico real contado.

| Campo | Valor Anterior | Valor Nuevo |
|-------|---------------|-------------|
| cantidad | $1,000.00 | $1,015.00 |
| billetes | $950.00 | $900.00 |
| monedas_fisicas | $50.00 | $115.00 |

### 2. Tabla `MovimientoSaldo`
Se crea un registro de ajuste.

| Campo | Valor |
|-------|-------|
| tipo_movimiento | INGRESO (o EGRESO) |
| monto | $15.00 |
| saldo_anterior | $1,000.00 |
| saldo_nuevo | $1,015.00 |
| tipo_referencia | CIERRE_DIARIO |
| descripcion | "AJUSTE CIERRE 2025-01-15" |
| saldo_bucket | "CAJA" |

### 3. Tabla `DetalleCuadreCaja`
Se guarda la diferencia detectada.

| Campo | Valor |
|-------|-------|
| saldo_cierre | $1,000.00 |
| conteo_fisico | $1,015.00 |
| diferencia | $15.00 |

---

## ⚠️ Consideraciones Importantes

### 1. **Idempotencia**
Si el cierre se intenta ejecutar dos veces, el sistema verifica si ya existe un ajuste con la misma referencia y no lo duplica.

```typescript
const yaExiste = await ejecutor.movimientoSaldo.findFirst({
  where: {
    tipo_referencia: TipoReferencia.CIERRE_DIARIO,
    referencia_id: cabecera.id,
    descripcion: { contains: "AJUSTE CIERRE" },
  },
});

if (!yaExiste) {
  // Solo crear si no existe
}
```

### 2. **Transaccionalidad**
Todo el proceso (actualizar saldo + crear ajuste) se ejecuta dentro de una transacción de base de datos. Si algo falla, todo se revierte.

### 3. **Trazabilidad**
Cada ajuste queda registrado con:
- Fecha del cierre
- Usuario que realizó el cierre
- Punto de atención
- Referencia al cuadre específico

### 4. **Diferencias Mínimas**
Solo se crean ajustes si la diferencia es >= $0.01 (1 centavo). Diferencias menores por redondeo no generan ajustes.

---

## 🔍 Cómo Ver los Ajustes

### En la Base de Datos:
```sql
-- Ver ajustes de un cierre específico
SELECT 
  ms.tipo_movimiento,
  ms.monto,
  ms.descripcion,
  ms.fecha,
  m.codigo as moneda,
  u.nombre as usuario
FROM "MovimientoSaldo" ms
JOIN "Moneda" m ON ms.moneda_id = m.id
JOIN "Usuario" u ON ms.usuario_id = u.id
WHERE ms.descripcion LIKE '%AJUSTE CIERRE%'
  AND ms.fecha >= '2025-01-15'
ORDER BY ms.fecha DESC;
```

### En la Aplicación:
Los ajustes aparecen en:
1. **Reportes de Movimientos** - Como transacciones tipo "AJUSTE CIERRE"
2. **Historial de Saldo** - En el detalle de cada moneda
3. **Contabilidad** - En el resumen diario

---

## ✅ Resumen

| Aspecto | Detalle |
|---------|---------|
| **Cuándo se crea** | Cuando conteo_fisico ≠ saldo_teorico (>= $0.01) |
| **Tipo de movimiento** | INGRESO si sobra, EGRESO si falta |
| **Monto** | Valor absoluto de la diferencia |
| **Tabla afectada** | MovimientoSaldo |
| **Prevención duplicados** | Verificación por referencia y descripción |
| **Transaccionalidad** | Todo en una transacción (rollback si falla) |
| **Trazabilidad** | Referencia al cuadre, usuario, fecha |

Este proceso garantiza que **los libros contables siempre cuadren** con la realidad física del dinero en caja.
